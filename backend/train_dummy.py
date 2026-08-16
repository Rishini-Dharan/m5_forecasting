import lightgbm as lgb
import numpy as np
import os

print("Generating fake training data...") #for 1000 rows
num_rows = 1000
prices = np.random.uniform(0.99, 19.99, num_rows)
is_weekend = np.random.randint(0, 2, num_rows)
is_snap_day = np.random.randint(0, 2, num_rows)

# Stack them side-by-side into a matrix (X)
X_train = np.column_stack((prices, is_weekend, is_snap_day))

# Target: Sales (Y). Let's make up a fake rule:Sales are higher on weekends and SNAP days, and lower if the price is high.
y_train = (is_weekend * 20) + (is_snap_day * 15) - (prices * 0.5) + np.random.normal(0, 2, num_rows)
y_train = np.maximum(y_train, 0)

print("Training a tiny LightGBM model (this will take 1 second)...")
train_data = lgb.Dataset(X_train, label=y_train)

params = {
    'objective': 'regression',
    'metric': 'rmse',
    'verbosity': -1
}
model = lgb.train(params, train_data, num_boost_round=10)

os.makedirs("models", exist_ok=True)

model_path = "models/lgb_model.txt"
model.save_model(model_path)

print(f"Success! Dummy model saved to {model_path}.")
print("You can now go to main.py, uncomment the model loader, and test your API!")
