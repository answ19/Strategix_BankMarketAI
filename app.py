from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "bank-additional-full.csv"
FRONTEND_DIST = ROOT / "frontend" / "dist"

PRIORITY_ORDER = ["Hot Lead", "Warm Lead", "Low Priority"]
GOALS = ["Maximize Profit", "Reduce Wasted Calls", "Maximize Conversions"]
STRATEGIES = {
    "Conservative": 0.70,
    "Balanced": 0.50,
    "Growth": 0.30,
}

app = FastAPI(title="Strategix API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    profile: dict[str, Any]


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        if pd.isna(value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def as_int(value: Any, default: int = 0) -> int:
    return int(round(as_float(value, default)))


def label_lead(probability: float) -> str:
    if probability >= 0.60:
        return "Hot Lead"
    if probability >= 0.30:
        return "Warm Lead"
    return "Low Priority"


def action_for_priority(priority: str) -> str:
    if priority == "Hot Lead":
        return "Contact early"
    if priority == "Warm Lead":
        return "Contact if capacity allows"
    return "Deprioritize"


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop(columns=["duration", "y", "y_binary"], errors="ignore").copy()


@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_FILE, sep=";")
    df.columns = df.columns.str.strip()
    return df


@lru_cache(maxsize=1)
def train_model_cached():
    df = load_data().copy()
    df["y_binary"] = df["y"].map({"yes": 1, "no": 0})

    X = prepare_features(df)
    y = df["y_binary"]

    numeric_cols = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
        ]
    )

    classifier = RandomForestClassifier(
        n_estimators=140,
        max_depth=11,
        min_samples_leaf=7,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "prAuc": float(average_precision_score(y_test, y_proba)),
        "rocAuc": float(roc_auc_score(y_test, y_proba)),
    }

    return model, metrics, numeric_cols, categorical_cols


def predict_probability(model, X: pd.DataFrame) -> np.ndarray:
    return np.clip(model.predict_proba(X)[:, 1], 0, 1)


@lru_cache(maxsize=1)
def scored_customers() -> pd.DataFrame:
    df = load_data().copy()
    model, _, _, _ = train_model_cached()
    probabilities = predict_probability(model, prepare_features(df))

    scored = df.copy()
    scored["score"] = probabilities
    scored["priority"] = scored["score"].apply(label_lead)
    scored = scored.sort_values("score", ascending=False).reset_index(drop=True)
    scored["rank"] = scored.index + 1
    return scored


@lru_cache(maxsize=1)
def feature_importance() -> list[dict[str, Any]]:
    model, _, _, _ = train_model_cached()
    preprocessor = model.named_steps["preprocessor"]
    classifier = model.named_steps["classifier"]

    try:
        feature_names = preprocessor.get_feature_names_out()
    except Exception:
        feature_names = [f"feature_{idx}" for idx in range(len(classifier.feature_importances_))]

    rows = []
    for feature, importance in zip(feature_names, classifier.feature_importances_):
        clean = str(feature).replace("num__", "").replace("cat__", "").replace("_", " ")
        rows.append({"feature": clean, "importance": float(importance)})

    return sorted(rows, key=lambda row: row["importance"], reverse=True)


def conversion_by(df: pd.DataFrame, column: str, min_contacts: int = 0) -> list[dict[str, Any]]:
    grouped = (
        df.groupby(column, observed=False)
        .agg(
            contacts=("y", "size"),
            subscriptions=("y", lambda values: int((values == "yes").sum())),
        )
        .reset_index()
    )
    grouped["conversionRate"] = grouped["subscriptions"] / grouped["contacts"]
    grouped = grouped[grouped["contacts"] >= min_contacts]
    grouped = grouped.sort_values("conversionRate", ascending=False)

    rows = []
    for _, row in grouped.iterrows():
        rows.append(
            {
                "name": str(row[column]),
                "contacts": int(row["contacts"]),
                "subscriptions": int(row["subscriptions"]),
                "conversionRate": float(row["conversionRate"]),
            }
        )
    return rows


def score_bands(scored: pd.DataFrame) -> list[dict[str, Any]]:
    bands_df = scored.copy()
    bands_df["band"] = pd.qcut(bands_df["score"], q=10, duplicates="drop")
    grouped = (
        bands_df.groupby("band", observed=False)
        .agg(
            customers=("y", "size"),
            actualSubscribers=("y", lambda values: int((values == "yes").sum())),
            avgScore=("score", "mean"),
        )
        .reset_index()
    )
    grouped["actualConversion"] = grouped["actualSubscribers"] / grouped["customers"]

    rows = []
    for _, row in grouped.iterrows():
        rows.append(
            {
                "band": str(row["band"]),
                "customers": int(row["customers"]),
                "actualSubscribers": int(row["actualSubscribers"]),
                "avgScore": float(row["avgScore"]),
                "actualConversion": float(row["actualConversion"]),
            }
        )
    return rows


def numeric_ranges(X: pd.DataFrame) -> dict[str, dict[str, float]]:
    ranges = {}
    for col in X.select_dtypes(include=["int64", "float64"]).columns:
        ranges[col] = {
            "min": float(X[col].min()),
            "max": float(X[col].max()),
            "median": float(X[col].median()),
            "integer": bool(pd.api.types.is_integer_dtype(X[col])),
        }
    return ranges


def category_options(X: pd.DataFrame) -> dict[str, list[str]]:
    options = {}
    for col in X.select_dtypes(include=["object", "category"]).columns:
        options[col] = sorted(str(value) for value in X[col].dropna().unique().tolist())
    return options


def default_profile(X: pd.DataFrame) -> dict[str, Any]:
    profile = {}
    for col in X.columns:
        if pd.api.types.is_numeric_dtype(X[col]):
            value = X[col].median()
            profile[col] = int(value) if pd.api.types.is_integer_dtype(X[col]) else float(value)
        else:
            profile[col] = str(X[col].mode(dropna=True).iloc[0])
    return profile


def lead_rows(scored: pd.DataFrame) -> list[dict[str, Any]]:
    columns = [
        "rank",
        "score",
        "priority",
        "age",
        "job",
        "marital",
        "education",
        "housing",
        "loan",
        "contact",
        "month",
        "campaign",
        "pdays",
        "previous",
        "poutcome",
        "y",
    ]
    rows = []
    for _, row in scored[columns].iterrows():
        rows.append(
            {
                "rank": int(row["rank"]),
                "score": float(row["score"]),
                "priority": str(row["priority"]),
                "age": int(row["age"]),
                "job": str(row["job"]),
                "marital": str(row["marital"]),
                "education": str(row["education"]),
                "housing": str(row["housing"]),
                "loan": str(row["loan"]),
                "contact": str(row["contact"]),
                "month": str(row["month"]),
                "campaign": int(row["campaign"]),
                "pdays": int(row["pdays"]),
                "previous": int(row["previous"]),
                "poutcome": str(row["poutcome"]),
                "outcome": str(row["y"]),
            }
        )
    return rows


def segment_signals(df: pd.DataFrame, profile: dict[str, Any]) -> list[dict[str, Any]]:
    signals = []
    for column in ["job", "education", "month", "poutcome", "contact", "housing", "loan"]:
        if column not in df.columns or column not in profile:
            continue

        segment = df[df[column].astype(str) == str(profile[column])]
        if len(segment) == 0:
            continue

        signals.append(
            {
                "signal": column.replace("_", " ").title(),
                "value": str(profile[column]),
                "contacts": int(len(segment)),
                "conversionRate": float((segment["y"] == "yes").mean()),
            }
        )
    return signals


@lru_cache(maxsize=1)
def bootstrap_payload() -> dict[str, Any]:
    df = load_data()
    scored = scored_customers()
    X = prepare_features(df)
    _, metrics, _, _ = train_model_cached()

    subscribers = int((df["y"] == "yes").sum())
    total = int(len(df))

    priority_counts = {
        priority: int((scored["priority"] == priority).sum())
        for priority in PRIORITY_ORDER
    }

    segments = {
        column: conversion_by(df, column)
        for column in ["job", "education", "marital", "housing", "loan", "contact", "month", "poutcome"]
        if column in df.columns
    }

    high_profile = prepare_features(scored.iloc[[0]]).iloc[0].to_dict()
    low_profile = prepare_features(scored.iloc[[-1]]).iloc[0].to_dict()

    return {
        "overview": {
            "totalCustomers": total,
            "subscribers": subscribers,
            "nonSubscribers": total - subscribers,
            "conversionRate": float(subscribers / total),
            "avgAge": float(df["age"].mean()),
            "priorityCounts": priority_counts,
            "highestScore": float(scored["score"].max()),
        },
        "goals": GOALS,
        "strategies": STRATEGIES,
        "metrics": metrics,
        "featureImportance": feature_importance(),
        "scoreBands": score_bands(scored),
        "segments": segments,
        "options": category_options(X),
        "ranges": numeric_ranges(X),
        "defaultProfile": default_profile(X),
        "presetProfiles": {
            "high": {key: clean_profile_value(value) for key, value in high_profile.items()},
            "low": {key: clean_profile_value(value) for key, value in low_profile.items()},
        },
        "leads": lead_rows(scored),
    }


def clean_profile_value(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if pd.isna(value):
        return None
    return value


def coerce_profile(profile: dict[str, Any]) -> pd.DataFrame:
    df = load_data()
    X = prepare_features(df)
    defaults = default_profile(X)

    clean = {}
    for column in X.columns:
        value = profile.get(column, defaults[column])
        if pd.api.types.is_numeric_dtype(X[column]):
            clean[column] = as_int(value) if pd.api.types.is_integer_dtype(X[column]) else as_float(value)
        else:
            clean[column] = str(value)

    return pd.DataFrame([clean], columns=X.columns)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, Any]:
    return bootstrap_payload()


@app.post("/api/predict")
def predict(request: PredictRequest) -> dict[str, Any]:
    model, _, _, _ = train_model_cached()
    profile_df = coerce_profile(request.profile)
    probability = float(predict_probability(model, profile_df)[0])
    priority = label_lead(probability)

    return {
        "probability": probability,
        "priority": priority,
        "action": action_for_priority(priority),
        "signals": segment_signals(load_data(), profile_df.iloc[0].to_dict()),
    }


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_index() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str) -> FileResponse:
        requested = FRONTEND_DIST / full_path
        if requested.exists() and requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIST / "index.html")

else:
    @app.get("/")
    def api_root() -> dict[str, str]:
        return {
            "name": "Strategix API",
            "frontend": "Run `npm run dev` inside the frontend folder.",
        }
