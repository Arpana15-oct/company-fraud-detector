#!/usr/bin/env python3
"""
@file predict.py
@description ML prediction script for company fraud detection.
Loads the trained model and makes predictions based on feature vector.
Uses feature scaling for better accuracy.
"""

import sys
import json
import joblib
import os
import numpy as np

def load_model_and_scaler():
    """Load the trained fraud detection model and feature scaler."""
    model_path = os.path.join(os.path.dirname(__file__), "company_fraud_model.pkl")
    scaler_path = os.path.join(os.path.dirname(__file__), "feature_scaler.pkl")
    
    try:
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None
        return model, scaler
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        return None, None

def predict_fraud(features, company_name="Unknown"):
    """
    Make fraud prediction based on feature vector.
    
    Feature order (must match CSV columns):
    0: hasUrgent
    1: noInterview
    2: quickMoney
    3: keywordCount
    4: domainMismatch
    5: foundOnLinkedIn
    6: jobsOnIndeed
    7: foundOnNaukri
    8: totalJobs
    """
    model, scaler = load_model_and_scaler()
    if model is None:
        return {
            "probability": 0.1,
            "risk_level": "Low",
            "error": "Failed to load model"
        }
    
    try:
        # Convert features to 2D array
        features_array = np.array(features).reshape(1, -1)
        
        # Apply feature scaling if scaler is available
        if scaler is not None:
            features_array = scaler.transform(features_array)
        
        # Get probability prediction
        prob = model.predict_proba(features_array)[0]
        
        # Assuming class 1 is fraud, get probability of fraud
        fraud_probability = prob[1] if len(prob) > 1 else prob[0]
        
        # Determine risk level
        if fraud_probability > 0.7:
            risk_level = "High"
        elif fraud_probability > 0.4:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        return {
            "probability": float(fraud_probability),
            "risk_level": risk_level,
            "company": company_name
        }
        
    except Exception as e:
        print(f"Prediction error: {e}", file=sys.stderr)
        return {
            "probability": 0.1,
            "risk_level": "Low",
            "error": str(e)
        }

def main():
    """Main function to handle command line arguments and make prediction."""
    if len(sys.argv) < 10:
        print(json.dumps({
            "probability": 0.1,
            "risk_level": "Low",
            "error": "Insufficient arguments. Expected 9 features + company name"
        }))
        sys.exit(1)
    
    # Parse command line arguments
    # Features: hasUrgent, noInterview, quickMoney, keywordCount, domainMismatch, 
    #           foundOnLinkedIn, jobsOnIndeed, foundOnNaukri, totalJobs
    features = []
    for i in range(1, 10):
        try:
            features.append(float(sys.argv[i]))
        except ValueError:
            features.append(0.0)
    
    # Last argument is company name
    company_name = sys.argv[10] if len(sys.argv) > 10 else "Unknown"
    
    # Make prediction
    result = predict_fraud(features, company_name)
    
    # Output JSON result
    print(json.dumps(result))

if __name__ == "__main__":
    main()
