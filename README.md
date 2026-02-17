# Fraud Detector UI - TrustVerify

A professional React-based web application to help students identify and analyze potentially fake companies through various data sources and analysis methods.

## Project Structure

```
fraud-detector-ui/
├── Backend/                    # Express.js backend server
│   ├── Routes/
│   │   └── Company.js         # API route handlers
│   ├── utils/
│   │   ├── Gemini.js          # AI-powered company analysis
│   │   ├── localExtractor.js  # NLP-based fraud detection
│   │   └── scraper.js         # Job site scraper
│   ├── server.js              # Express server entry point
│   ├── predict.py             # ML prediction script
│   ├── train_model.py         # Model training script
│   ├── companies_sample.csv   # Training data
│   ├── company_fraud_model.pkl # Trained ML model
│   └── package.json           # Backend dependencies
├── curr/fake-detector/        # React/Vite frontend
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   └── App.css           # Styles
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js         # Vite configuration
└── README.md                   # This file
```

## Features

- **ML-based Fraud Detection**: Uses a trained logistic regression model to detect fraudulent companies
- **AI-Powered Analysis**: Integrates Google Gemini for advanced company analysis
- **Job Site Scraping**: Checks company presence on LinkedIn, Indeed, and Naukri
- **Document Analysis**: Upload offer letters for analysis (PDF, images, text)
- **Real-time Chat**: Interactive chat interface for company analysis

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- npm or yarn

## Installation

### 1. Clone and Navigate to Project

```
bash
cd fraud-detector-ui
```

### 2. Install Backend Dependencies

```
bash
cd Backend
npm install
```

### 3. Install Frontend Dependencies

```
bash
cd ../curr/fake-detector
npm install
```

### 4. Install Python Dependencies

```
bash
# Navigate to Backend folder
cd ../../Backend

# Create virtual environment (optional but recommended)
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate

# Install required packages
pip install numpy pandas scikit-learn joblib
```

### 5. Configure Environment Variables

1. Copy the example environment file:
```
bash
cp .env.example .env
```

2. Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

**Note**: The ML prediction (predict endpoint) works without the API key, but AI analysis features (analyze, chat endpoints) require it.

## Running the Project

### 1. Start the Backend Server

```
bash
cd Backend
npm start
```

The backend will start on http://localhost:5001

### 2. Start the Frontend (in a new terminal)

```
bash
cd curr/fake-detector
npm run dev
```

The frontend will start on http://localhost:5173

### 3. Open the Application

Open your browser and navigate to http://localhost:5173

## Usage

### Using the Chat Interface

Enter company details in the format:
```
Company: [Company Name], Description: [Job Description]
```

Example:
```
Company: Apple, Description: Hiring software engineers. No interview required. Immediate joining.
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/company/predict` | POST | ML-based fraud detection |
| `/api/company/analyze` | POST | AI-powered company analysis |
| `/api/company/chat` | POST | Interactive chat analysis |
| `/api/company/upload` | POST | Document upload & analysis |

## Troubleshooting

### Backend Issues

1. **Port 5001 already in use**
   - Check if another process is using port 5001
   - Edit `server.js` to change the port

2. **Python prediction fails**
   - Ensure Python dependencies are installed: `pip install numpy pandas scikit-learn joblib`
   - Check if `company_fraud_model.pkl` exists

3. **Gemini API errors**
   - Ensure `.env` file exists with valid `GEMINI_API_KEY`
   - Check the API key is valid and has sufficient quota

### Frontend Issues

1. **Can't connect to backend**
   - Ensure backend is running on port 5001
   - Check CORS settings in `server.js`

2. **Build errors**
   - Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Development

### Training a New Model

If you want to retrain the model:

```
bash
cd Backend
python train_model.py
```

This will create a new `company_fraud_model.pkl` file.

### Testing the Prediction Script

```
bash
cd Backend
python predict.py 1 0 1 5 1 0 0 0 0 "Test Company"
```

## License

MIT License
