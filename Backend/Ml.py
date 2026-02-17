import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

# Train an improved model with better algorithms and tuning
if __name__ == '__main__':
    print("=" * 60)
    print("Fraud Detection Model Training - Improved Version")
    print("=" * 60)
    
    # Load dataset
    df = pd.read_csv("companies_sample.csv")
    print(f"\nDataset loaded: {len(df)} samples")
    print(f"Features: {list(df.columns[:-1])}")
    print(f"Class distribution:\n{df['label'].value_counts()}")
    
    X = df.drop("label", axis=1)
    y = df["label"]

    # Scale features for better performance
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Split data with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Try Random Forest - typically better for this type of problem
    print("\n" + "=" * 60)
    print("Training Random Forest Classifier")
    print("=" * 60)
    
    # Use Random Forest with optimized parameters
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=7,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    
    # Cross-validation
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
    print(f"\nCross-Validation Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    
    # Train model
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Test Accuracy: {accuracy:.4f}")
    print(f"\nClassification Report:\n{classification_report(y_test, y_pred)}")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    print(f"\nFeature Importance:\n{feature_importance}")
    
    # Save model and scaler
    joblib.dump(model, "company_fraud_model.pkl")
    joblib.dump(scaler, "feature_scaler.pkl")
    print(f"\nSaved company_fraud_model.pkl")
    print(f"Saved feature_scaler.pkl")
    print("\nTraining complete!")
