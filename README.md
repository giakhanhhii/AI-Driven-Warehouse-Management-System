# AI-Driven Warehouse Management System

An AI-assisted warehouse management demo for inventory monitoring, replenishment support, demand forecasting, and role-based operational workflows.

This project combines:

- a `FastAPI` backend
- a lightweight web frontend
- AI-assisted warehouse Q&A
- inventory decision support based on `ROP`, `ABC/XYZ`, and demand forecasting

## Key Features

- Inventory lookup by material name or code
- ROP-based low stock alerts
- Purchase request and approval workflow
- Goods receipt and goods issue flows
- Demand forecasting with:
  - Linear Regression
  - Random Forest
  - SVR
- AI assistant that explains stock status and suggests actions
- Role-based chat sessions:
  - `Warehouse Manager`
  - `Warehouse Staff`

## Tech Stack

- Python
- FastAPI
- SQLAlchemy
- SQLite
- OpenAI API
- scikit-learn
- HTML / CSS / JavaScript

## Project Structure

```text
WarehouseAI/
├── backend/
│   ├── ai/
│   ├── routers/
│   ├── services/
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── schemas.py
│   └── seed.py
├── frontend/
│   ├── api.js
│   ├── app.js
│   ├── dashboard.js
│   ├── index.html
│   ├── mock_data.js
│   └── style.css
├── .env
├── .env.example
├── run.bat
└── start.py
```

## Requirements

- Python 3.10+ recommended
- Windows, macOS, or Linux
- Internet connection only if you want OpenAI-powered chat responses

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/giakhanhhii/AI-Driven-Warehouse-Management-System.git
cd AI-Driven-Warehouse-Management-System
```

### 2. Create and activate a virtual environment

Windows:

```bash
py -3 -m venv .venv
.venv\Scripts\activate
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure the OpenAI API key

The repository already includes a `.env` file so non-technical users can open it directly.

Open `.env` and fill in:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Example:

```env
OPENAI_API_KEY=sk-...
```

Other useful settings in `.env`:

```env
APP_PORT=8001
START_PORT_MODE=fixed
AUTO_OPEN_BROWSER=0
```

### Important note

- If `OPENAI_API_KEY` is provided, the chat assistant can use OpenAI for richer natural-language responses.
- If `OPENAI_API_KEY` is left empty, the application still runs and uses built-in fallback warehouse logic for many core queries.

## Optional: Keep Your Real API Key Private

If you do not want to store your real API key in `.env`, create a local file named `.env.local` and place your secret there:

```env
OPENAI_API_KEY=your_real_key_here
```

The app is configured to prefer `.env.local` over `.env`, so:

- `.env` can stay clean and shareable
- `.env.local` stays private and is ignored by Git

## Seed Demo Data

To load demo materials, inventory, and consumption history:

```bash
cd backend
python seed.py
cd ..
```

This creates sample data for:

- materials
- inventory
- purchase logic
- ROP checks
- forecasting models

## Run the Application

### Recommended

Run:

```bash
python start.py
```

Or on Windows:

```bash
run.bat
```

The app starts on a single port and serves both:

- backend API
- frontend UI

Default URL:

```text
http://127.0.0.1:8001/?backend=http%3A%2F%2F127.0.0.1%3A8001
```

## Main Usage Flow

### Warehouse Manager

- view full warehouse overview
- access purchasing
- review low-stock materials under ROP
- compare forecasting models
- check ABC/XYZ groups

### Warehouse Staff

- inspect stock quickly
- create material requests
- perform warehouse-related chat queries
- cannot access the purchasing approval screen

Each chat session keeps its own role and state independently.

## Example Questions for the AI Assistant

- `Which materials are below ROP?`
- `Summarize the current inventory situation`
- `Forecast demand for Dầu nhớt ISO 46 next period`
- `Which materials are safe to recommend to customers?`
- `Which materials in group BX?`

## Forecasting Interpretation

The system compares:

- Linear Regression
- Random Forest
- SVR

This helps users:

- avoid depending on a single model
- compare stable vs. volatile predictions
- decide whether to buy now, monitor more closely, or adjust safety stock

The assistant also explains:

- what action should be taken for the current material
- what the warehouse should be careful about before purchasing

## API Endpoints

Examples:

- `GET /health`
- `POST /api/chat`
- `GET /api/inventory`
- `POST /api/gr`
- `POST /api/gi`
- `GET /api/purchase-requests`
- `GET /api/dashboard/kpis`

## Troubleshooting

### The app runs but OpenAI chat does not work

Check that:

- `.env` contains a valid `OPENAI_API_KEY`
- your internet connection is available
- the key has not expired and has API access enabled

### The app runs without an API key

That is expected. The system will continue using fallback warehouse logic for many built-in questions.

### Port already in use

Set in `.env`:

```env
START_PORT_MODE=auto
```

This allows the app to find a free port automatically.

### No demo data appears

Run:

```bash
cd backend
python seed.py
```

## Git Notes

This repository is configured to ignore unnecessary local files such as:

- local database files
- browser temp files
- export images and diagrams
- thesis / planning artifacts
- local secrets in `.env.local`

## License

This project is provided for academic / demonstration purposes.
