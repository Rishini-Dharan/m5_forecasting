"""Plain-language names for the 34 model features.

The raw feature names are training-pipeline identifiers. Showing `lag_7_div_rolling_28` to a
store manager explains nothing, so every feature carries a short label and a sentence saying
what it measures.
"""

GLOSSARY = {
    "item_id": ("Item", "Which product this is. The model learns per-item demand levels."),
    "dept_id": ("Department", "The product's department, e.g. FOODS_1."),
    "cat_id": ("Category", "Broad category: Foods, Hobbies or Household."),
    "store_id": ("Store", "Which store. Stores differ a lot in baseline volume."),
    "state_id": ("State", "CA, TX or WI."),
    "wm_yr_wk": ("Retail week", "Walmart retail week number, capturing slow seasonal drift."),
    "weekday": ("Day name", "Day of the week as a name."),
    "wday": ("Day of week", "Day of week, 1 = Saturday through 7 = Friday."),
    "month": ("Month", "Calendar month, capturing seasonality."),
    "year": ("Year", "Calendar year."),
    "snap_CA": ("SNAP day (CA)", "Whether California food benefits are distributed that day."),
    "snap_TX": ("SNAP day (TX)", "Whether Texas food benefits are distributed that day."),
    "snap_WI": ("SNAP day (WI)", "Whether Wisconsin food benefits are distributed that day."),
    "sell_price": ("Price", "The item's shelf price that week."),
    "lag_7": ("Sales 7 days ago", "Units sold one week before the day being forecast."),
    "lag_14": ("Sales 14 days ago", "Units sold two weeks before."),
    "lag_21": ("Sales 21 days ago", "Units sold three weeks before."),
    "lag_28": ("Sales 28 days ago", "Units sold four weeks before."),
    "lag_35": ("Sales 35 days ago", "Units sold five weeks before."),
    "lag_42": ("Sales 42 days ago", "Units sold six weeks before."),
    "rolling_mean_7": ("Avg sales, last 7 days", "Recent demand level. The strongest driver in this model."),
    "rolling_std_7": ("Volatility, last 7 days", "How erratic demand has been over the past week."),
    "rolling_mean_28": ("Avg sales, last 28 days", "Demand level over the past month."),
    "rolling_std_28": ("Volatility, last 28 days", "How erratic demand has been over the past month."),
    "rolling_mean_60": ("Avg sales, last 60 days", "Medium-term demand level."),
    "rolling_mean_180": ("Avg sales, last 180 days", "Long-run demand level, free of short-term noise."),
    "lag_7_div_rolling_28": ("Last week vs monthly avg", "Whether last week ran hot or cold against the monthly average."),
    "price_vs_hist_max": ("Price vs its highest", "Current price against the highest this item has charged."),
    "price_vs_dept_mean": ("Price vs department avg", "Whether this item is cheap or dear for its department."),
    "days_since_last_nonzero": ("Days since a sale", "How long since this item last sold. High values mean sparse demand."),
    "weeks_since_release": ("Weeks on sale", "How long the item has been available."),
    "te_dept_id": ("Department demand history", "Encoded average demand for this department."),
    "te_store_id": ("Store demand history", "Encoded average demand for this store."),
    "te_item_id": ("Item demand history", "Encoded average demand for this item."),
}


def label_for(feature: str) -> str:
    return GLOSSARY.get(feature, (feature, ""))[0]


def describe(feature: str) -> dict:
    label, description = GLOSSARY.get(feature, (feature, "No description available."))
    return {"feature": feature, "label": label, "description": description}
