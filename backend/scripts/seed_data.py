"""Seed historical_sales.

Replaces populate_data.py / seed_sales.py / seed_real_data.py, which each truncated the table
and disagreed about both the day range and whether the data was real.

  --source npn        (default) real M5 sales pulled from the model's own history_tail.parquet.
                      Needs no Kaggle download, and guarantees the database agrees with the
                      series the models were trained on.
  --source m5-csv     real M5 sales from sales_train_evaluation.csv, via --path.
  --source synthetic  generated data, for when there is no network. Clearly labelled as fake.

Examples:
  python scripts/seed_data.py --source npn --stores CA_1 CA_2
  python scripts/seed_data.py --source m5-csv --path ../m5-forecasting-accuracy/sales_train_evaluation.csv
  python scripts/seed_data.py --source synthetic --no-truncate
"""

import argparse
import os
import random
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.db import db, init_db  # noqa: E402

BATCH_SIZE = 5000
DEFAULT_DAYS = 28


def _insert(rows, truncate: bool):
    if truncate:
        db.execute_query("TRUNCATE TABLE historical_sales RESTART IDENTITY;")
        print("Truncated historical_sales.")

    total = 0
    batch = []
    for row in rows:
        batch.append(row)
        if len(batch) >= BATCH_SIZE:
            total += _flush(batch)
            batch = []
    if batch:
        total += _flush(batch)
    return total


def _flush(batch):
    values = ",".join(["(%s,%s,%s,%s)"] * len(batch))
    params = [field for row in batch for field in row]
    db.execute_query(
        f"INSERT INTO historical_sales (item_id, store_id, day_index, sales) VALUES {values}",
        params,
    )
    print(f"  ... {len(batch)} rows")
    return len(batch)


def from_npn(stores, days, items_limit):
    """Real M5 sales, read from the model's published history_tail.parquet."""
    import pandas as pd
    from huggingface_hub import hf_hub_download

    from config import settings

    path = hf_hub_download(repo_id=settings.NPN_REPO, filename="history_tail.parquet")
    filters = [("store_id", "in", stores)] if stores else None
    tail = pd.read_parquet(
        path, columns=["item_id", "store_id", "d_num", "sales"], filters=filters
    )

    cutoff = tail["d_num"].max() - days + 1
    tail = tail[tail["d_num"] >= cutoff]

    if items_limit:
        keep = sorted(tail["item_id"].astype(str).unique())[:items_limit]
        tail = tail[tail["item_id"].astype(str).isin(keep)]

    print(
        f"Source: real M5 sales from {settings.NPN_REPO}/history_tail.parquet "
        f"(days d_{cutoff}..d_{tail['d_num'].max()}, {tail['item_id'].nunique()} items, "
        f"{tail['store_id'].nunique()} stores)"
    )
    for row in tail.itertuples(index=False):
        yield (str(row.item_id), str(row.store_id), int(row.d_num), int(row.sales))


def from_m5_csv(path, stores, days, items_limit):
    """Real M5 sales from the Kaggle CSV."""
    import pandas as pd

    if not os.path.exists(path):
        raise SystemExit(
            f"M5 CSV not found at: {path}\n"
            "Download sales_train_evaluation.csv from the Kaggle M5 competition, or use "
            "--source npn, which needs no download."
        )

    header = pd.read_csv(path, nrows=0)
    day_cols = [c for c in header.columns if c.startswith("d_")]
    day_cols = sorted(day_cols, key=lambda c: int(c[2:]))[-days:]

    frame = pd.read_csv(path, usecols=["item_id", "store_id"] + day_cols)
    if stores:
        frame = frame[frame["store_id"].isin(stores)]
    if items_limit:
        frame = frame[frame["item_id"].isin(sorted(frame["item_id"].unique())[:items_limit])]

    melted = frame.melt(
        id_vars=["item_id", "store_id"], value_vars=day_cols, var_name="d", value_name="sales"
    )
    melted["day_index"] = melted["d"].str[2:].astype(int)

    print(f"Source: real M5 sales from {path} ({day_cols[0]}..{day_cols[-1]})")
    for row in melted.itertuples(index=False):
        yield (str(row.item_id), str(row.store_id), int(row.day_index), int(row.sales))


def from_synthetic(stores, days, items_limit):
    """Generated data. Not real M5 sales -- for offline use only."""
    random.seed(42)
    items = [
        "HOBBIES_1_001", "HOBBIES_1_002", "FOODS_1_001", "FOODS_2_001", "HOUSEHOLD_1_001",
    ][: items_limit or 5]
    stores = stores or ["CA_1", "CA_2", "TX_1"]
    base_volume = {item: random.randint(20, 200) for item in items}
    store_multiplier = {store: random.uniform(0.7, 1.4) for store in stores}

    print(f"Source: SYNTHETIC (not real M5 data) -- {len(items)} items x {len(stores)} stores x {days} days")
    for item in items:
        for store in stores:
            for day in range(1, days + 1):
                volume = base_volume[item] * store_multiplier[store]
                if day % 7 in (0, 6):
                    volume *= 1.3
                volume += day * 0.5
                volume += random.uniform(-0.1, 0.1) * volume
                yield (item, store, day, max(0, int(round(volume))))


def main():
    parser = argparse.ArgumentParser(description="Seed the historical_sales table.")
    parser.add_argument("--source", choices=["npn", "m5-csv", "synthetic"], default="npn")
    parser.add_argument("--path", help="Path to sales_train_evaluation.csv (for --source m5-csv)")
    parser.add_argument("--stores", nargs="*", help="Limit to these store IDs, e.g. CA_1 TX_1")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"Days of history (default {DEFAULT_DAYS})")
    parser.add_argument("--items", type=int, help="Limit to the first N items, for a lighter demo")
    parser.add_argument("--no-truncate", action="store_true", help="Append instead of replacing")
    args = parser.parse_args()

    if args.source == "m5-csv" and not args.path:
        raise SystemExit("--source m5-csv requires --path to sales_train_evaluation.csv")

    init_db()

    if args.source == "npn":
        rows = from_npn(args.stores, args.days, args.items)
    elif args.source == "m5-csv":
        rows = from_m5_csv(args.path, args.stores, args.days, args.items)
    else:
        rows = from_synthetic(args.stores, args.days, args.items)

    total = _insert(rows, truncate=not args.no_truncate)
    print(f"\nDone. Inserted {total:,} rows into historical_sales.")
    if args.source == "synthetic":
        print("WARNING: this data is generated, not real M5 sales.")


if __name__ == "__main__":
    main()
