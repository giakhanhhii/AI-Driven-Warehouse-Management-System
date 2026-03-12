# 📦 AI-Driven Warehouse Management System

<p align="center">
  <img src="https://img.shields.io/badge/Author-Nguyen%20Trieu%20Gia%20Khanh-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/University-Thuongmai%20University-maroon?style=for-the-badge" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/LangChain-121011?style=for-the-badge&logo=chainlink&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Pinecone-000000?style=for-the-badge&logo=pinecone&logoColor=white" />
  <img src="https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=Streamlit&logoColor=white" />
</p>

---

## 🌟 Project Overview

This project is an **Intelligent Warehouse Management System** developed by **Nguyen Trieu Gia Khanh**. It integrates advanced AI capabilities to optimize logistics and inventory operations. By combining traditional relational databases with **RAG (Retrieval-Augmented Generation)**, the system allows managers to interact with warehouse data using natural language.

> **Research Focus:** Bridging the gap between structured inventory data (SQL) and unstructured logistics documentation through AI Agents.

---

## ✨ Key Features

- 🤖 **AI-Driven Querying:** Ask complex questions like *"Which items are nearing expiration and should be prioritized for shipping?"*
- 🔍 **Hybrid Search Engine:** Combines **PostgreSQL** (structured data) and **Pinecone** (semantic search) for 100% information coverage.
- 📈 **Predictive Insights:** Automated reporting on stock movements and potential supply chain bottlenecks.
- 💬 **Multi-turn AI Agent:** A Langchain-powered agent that maintains context for sophisticated warehouse reasoning.
- 🐳 **Docker-Ready:** Scalable architecture designed for environment consistency and seamless deployment.

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **LLM Orchestration** | LangChain & OpenAI GPT-4 |
| **Vector Database** | Pinecone (High-dimensional embedding search) |
| **Relational Database** | PostgreSQL |
| **UI Framework** | Streamlit Dashboard |
| **Infrastructure** | Docker & Docker Compose |

---

## 📂 Project Structure

```bash
├── configs/              # LLM prompts, DB connections, and API settings
├── data/                 # Sample datasets (Northwind/Custom Warehouse Data)
├── src/
│   ├── agents/           # LangChain agent logic and tool definitions
│   ├── database/         # SQL schemas and PostgreSQL connectors
│   └── embedding/        # Logic for document chunking and VectorDB upserts
├── ui/                   # Streamlit dashboard and Chatbot interface
└── docker-compose.yml    # Infrastructure orchestration
```

## 🚀 Quick Start
1️⃣ Environment Configuration
Bash
```bash
git clone [https://github.com/giakhanhhii/AI-Driven-Warehouse-Management-System.git](https://github.com/giakhanhhii/AI-Driven-Warehouse-Management-System.git)

cd AI-Driven-Warehouse-Management-System

python -m venv venv

source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

```

2️⃣ Run Application
```bash

# Launch database services

docker-compose up -d

```

## Start the AI Dashboard
```bash

streamlit run ui/app.py

```

## 🧠 Methodology
The system operates on a Dual-Path Retrieval mechanism:

Deterministic Path: AI Agent translates natural language into SQL queries for precise inventory counts.

Semantic Path: Logistics manuals are embedded and retrieved from Pinecone to answer policy-based questions.

The LangChain Agent acts as the central brain, deciding which path to take based on the user's intent.

## 🎓 Academic Background
This project is part of a research study conducted at Thuongmai University (TMU), Hanoi.

Author: Nguyen Trieu Gia Khanh

Department: Management Information Systems (MIS)

License: MIT License
