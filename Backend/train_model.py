import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
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
    df = pd.read_csv('companies_sample.csv')
    print(f"\nDataset loaded: {len(df)} samples")
    print(f"Features: {list(df.columns[:-1])}")
    print(f"Class distribution:\n{df['label'].value_counts()}")
    
    X = df.drop('label', axis=1)
    y = df['label']

    # Scale features for better performance
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Try multiple models and compare
    models = {
        'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
        'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42, learning_rate=0.1)
    }
    
    best_model = None
    best_accuracy = 0
    best_model_name = ""
    
    print("\n" + "=" * 60)
    print("Model Comparison (with 5-fold Cross-Validation)")
    print("=" * 60)
    
    for name, model in models.items():
        # Cross-validation
        cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='accuracy')
        
        # Train on full training set
        model.fit(X_train, y_train)
        
        # Predict on test set
        y_pred = model.predict(X_test)
        test_accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\n{name}:")
        print(f"  CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        print(f"  Test Accuracy: {test_accuracy:.4f}")
        
        if test_accuracy > best_accuracy:
            best_accuracy = test_accuracy
            best_model = model
            best_model_name = name
    
    print("\n" + "=" * 60)
    print(f"Best Model: {best_model_name} with accuracy {best_accuracy:.4f}")
    print("=" * 60)
    
    # Hyperparameter tuning for the best model
    print("\nPerforming hyperparameter tuning...")
    
    if best_model_name == 'Random Forest':
        param_grid = {
            'n_estimators': [50, 100, 200],
            'max_depth': [3, 5, 7, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        tuned_model = RandomForestClassifier(random_state=42, n_jobs=-1)
    else:
        param_grid = {
            'n_estimators': [50, 100, 200],
            'learning_rate': [0.01, 0.1, 0.2],
            'max_depth': [3, 5, 7],
            'min_samples_split': [2, 5, 10]
        }
        tuned_model = GradientBoostingClassifier(random_state=42)
    
    grid_search = GridSearchCV(
        tuned_model, param_grid, cv=5, scoring='accuracy', n_jobs=-1, verbose=1
    )
    grid_search.fit(X_train, y_train)
    
    print(f"\nBest parameters: {grid_search.best_params_}")
    print(f"Best CV accuracy: {grid_search.best_score_:.4f}")
    
    # Use the best model from grid search
    final_model = grid_search.best_estimator_
    
    # Final evaluation
    y_pred = final_model.predict(X_test)
    final_accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "=" * 60)
    print("Final Model Evaluation")
    print("=" * 60)
    print(f"\nFinal Test Accuracy: {final_accuracy:.4f}")
    print(f"\nClassification Report:\n{classification_report(y_test, y_pred)}")
    print(f"\nConfusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
    
    # Feature importance
    if hasattr(final_model, 'feature_importances_'):
        feature_importance = pd.DataFrame({
            'feature': X.columns,
            'importance': final_model.feature_importances_
        }).sort_values('importance', ascending=False)
        print(f"\nFeature Importance:\n{feature_importance}")
    
    # Save model and scaler
    joblib.dump(final_model, 'company_fraud_model.pkl')
    joblib.dump(scaler, 'feature_scaler.pkl')
    print(f"\nSaved company_fraud_model.pkl")
    print(f"Saved feature_scaler.pkl")
    print("\nTraining complete!")
