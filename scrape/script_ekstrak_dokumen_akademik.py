
from bs4 import BeautifulSoup
import pandas as pd
from pathlib import Path

# File HTML hasil scraping
html_file = Path("dokumen_renstra.html")

# Baca HTML
with open(html_file, "r", encoding="utf-8") as file:
    soup = BeautifulSoup(file, "html.parser")

data = []

# Setiap tr merupakan satu dokumen
rows = soup.find_all("tr")

for row in rows:
    # Nama dokumen dan link download
    document_cell = row.find(
        "td",
        class_="__dt_col_0"
    )

    if not document_cell:
        continue

    document_link = document_cell.find("a", href=True)

    if not document_link:
        continue

    nama_dokumen = document_link.get_text(strip=True)
    link_dokumen = document_link["href"]

    # Kategori dokumen
    category_cell = row.find(
        "td",
        class_="__dt_col_1"
    )

    kategori = []

    if category_cell:
        category_links = category_cell.find_all("a")

        kategori = [
            link.get_text(strip=True)
            for link in category_links
            if link.get_text(strip=True)
        ]

    # Tanggal update dokumen
    date_cell = row.find(
        "td",
        class_="__dt_col_2"
    )

    tanggal_update = None

    if date_cell:
        date_span = date_cell.find(
            "span",
            class_="__dt_update_date"
        )

        if date_span:
            tanggal_update = date_span.get_text(strip=True)

    # Simpan hasil ekstraksi
    data.append({
        "nama_dokumen": nama_dokumen,
        "link_dokumen": link_dokumen,
        "kategori_dokumen": ", ".join(kategori),
        "tanggal_update": tanggal_update
    })

# Buat DataFrame
df = pd.DataFrame(data)

# Simpan hasil ekstraksi ke JSON
df.to_json(
    "hasil_ekstraksi_renstra.json",
    orient="records",
    indent=4,
    force_ascii=False
)

print(f"Berhasil mengekstrak {len(df)} dokumen.")