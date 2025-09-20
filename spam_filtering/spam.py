import os
import re
import pickle
import pandas as pd
import kagglehub

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# 1. Download Enron Dataset
print("⬇️ Downloading Enron dataset...")
path = kagglehub.dataset_download("wcukierski/enron-email-dataset")
print("✅ Dataset downloaded at:", path)

# 2. Load Data
# The Enron dataset from Kaggle is a CSV: "emails.csv"
data_path = os.path.join(path, "emails.csv")
df = pd.read_csv(data_path)

print("📊 Dataset shape:", df.shape)
print(df.head())

# 3. Basic Preprocessing
def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+", " url ", text)      # remove links
    text = re.sub(r"[^a-z\s]", " ", text)         # keep only letters
    text = re.sub(r"\s+", " ", text)              # remove extra spaces
    return text.strip()

df["text"] = df["message"].apply(clean_text)

# ⚠️ NOTE: The original Enron dataset does not come pre-labeled spam/ham.
# For Kaggle version, there’s usually a "spam" column (1=spam, 0=ham).
if "spam" in df.columns:
    labels = df["spam"]
else:
    raise ValueError("Dataset does not include spam labels. Please use Enron-Spam subset with labels.")

# 4. Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(
    df["text"], labels, test_size=0.2, random_state=42
)

# 5. TF-IDF Vectorization
vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# 6. Train Model (Naive Bayes)
model = MultinomialNB()
model.fit(X_train_tfidf, y_train)

# 7. Evaluate
y_pred = model.predict(X_test_tfidf)
print("\n📌 Accuracy:", accuracy_score(y_test, y_pred))
print("\n📌 Classification Report:\n", classification_report(y_test, y_pred))

# 8. Save Model + Vectorizer
pickle.dump(model, open("spam_model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))

print("✅ Model and vectorizer saved!")
