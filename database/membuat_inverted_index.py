
import json
import re
import math
from pathlib import Path
from collections import Counter, defaultdict


# ==========================================
# 1. KONFIGURASI
# ==========================================

COLLECTION_FILE = Path("database/collection.json")
OUTPUT_INDEX = Path("database/inverted_index.json")
OUTPUT_METADATA = Path("database/index_metadata.json")


# ==========================================
# 2. PREPROCESSING
# ==========================================

def preprocess(text):
    """
    Preprocessing sederhana:
    - Case folding
    - Menghapus karakter selain huruf dan angka
    - Tokenization
    """

    text = str(text).lower()

    # Menghapus karakter khusus
    text = re.sub(r"[^a-z0-9\s]", " ", text)

    # Tokenization
    tokens = text.split()

    return tokens


# ==========================================
# 3. MEMBACA COLLECTION
# ==========================================

with open(COLLECTION_FILE, "r", encoding="utf-8") as file:
    collection = json.load(file)

total_documents = len(collection)

print(f"Total dokumen: {total_documents}")


# ==========================================
# 4. MEMBANGUN INVERTED INDEX
# ==========================================

inverted_index = defaultdict(list)

document_lengths = {}

for document in collection:

    doc_id = document["doc_id"]

    # Menggabungkan judul dan isi dokumen
    title = document.get("nama_dokumen", "")
    content = document.get("content", "")

    text = f"{title} {content}"

    # Preprocessing
    tokens = preprocess(text)

    # Menghitung TF
    term_frequencies = Counter(tokens)

    # Panjang dokumen setelah preprocessing
    document_lengths[doc_id] = len(tokens)

    # Memasukkan term ke posting list
    for term, tf in term_frequencies.items():

        inverted_index[term].append({
            "doc_id": doc_id,
            "tf": tf
        })


# ==========================================
# 5. MENGHITUNG DF, IDF, DAN TF-IDF
# ==========================================

final_index = {}

for term, posting_list in inverted_index.items():

    # Document Frequency
    df = len(posting_list)

    # Inverse Document Frequency
    idf = math.log10(total_documents / df)

    # Menghitung TF-IDF setiap dokumen
    for posting in posting_list:

        tf = posting["tf"]

        posting["tfidf"] = round(tf * idf, 6)

    final_index[term] = {
        "df": df,
        "idf": round(idf, 6),
        "posting_list": posting_list
    }


# ==========================================
# 6. METADATA INDEX
# ==========================================

average_document_length = (
    sum(document_lengths.values()) / total_documents
    if total_documents > 0 else 0
)

metadata = {
    "total_documents": total_documents,
    "total_terms": len(final_index),
    "average_document_length": round(
        average_document_length, 2
    ),
    "document_lengths": document_lengths
}


# ==========================================
# 7. MENYIMPAN HASIL
# ==========================================

OUTPUT_INDEX.parent.mkdir(
    parents=True,
    exist_ok=True
)

with open(OUTPUT_INDEX, "w", encoding="utf-8") as file:
    json.dump(
        final_index,
        file,
        ensure_ascii=False,
        indent=4
    )

with open(OUTPUT_METADATA, "w", encoding="utf-8") as file:
    json.dump(
        metadata,
        file,
        ensure_ascii=False,
        indent=4
    )


# ==========================================
# 8. INFORMASI HASIL
# ==========================================

print("\nIndexing berhasil!")

print(f"Total dokumen : {total_documents}")
print(f"Total term    : {len(final_index)}")
print(f"Rata-rata panjang dokumen : {average_document_length:.2f}")

print(f"\nInverted index : {OUTPUT_INDEX}")
print(f"Metadata       : {OUTPUT_METADATA}")
