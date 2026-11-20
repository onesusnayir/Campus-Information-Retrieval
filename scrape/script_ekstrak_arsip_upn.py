
from bs4 import BeautifulSoup
import pandas as pd
from pathlib import Path

# File HTML hasil scraping
html_file = Path("arsip_upn.html")

# Baca HTML
with open(html_file, "r", encoding="utf-8") as file:
    soup = BeautifulSoup(file, "html.parser")

data = []

# Semua data berada dalam ul.list-group
container = soup.find("ul", class_="list-group")

if container:
    # Setiap li merupakan satu dokumen
    rows = container.find_all(
        "li",
        class_="event-details list-group-item file-pdf",
        recursive=False
    )

    for row in rows:
        # Nama dokumen dan link download
        anchor = row.find("a", href=True)

        if not anchor:
            continue

        heading = anchor.find("h4")

        if not heading:
            continue

        nama_dokumen = heading.get_text(strip=True)
        link_dokumen = anchor["href"]

        # Kategori dokumen tidak tersedia
        kategori_dokumen = ""

        # Tanggal update dokumen
        tanggal_update = ""

        date_list = row.find(
            "ul",
            class_="list-inline font-12 mb-10 mt-10"
        )

        if date_list:
            date_item = date_list.find("li")

            if date_item:
                date_strong = date_item.find("strong")

                if date_strong:
                    tanggal_update = date_strong.get_text(strip=True)

        # Simpan hasil ekstraksi
        data.append({
            "nama_dokumen": nama_dokumen,
            "link_dokumen": link_dokumen,
            "kategori_dokumen": kategori_dokumen,
            "tanggal_update": tanggal_update
        })

# Simpan ke JSON
df = pd.DataFrame(data)

df.to_json(
    "hasil_ekstraksi_arsip_upn.json",
    orient="records",
    indent=4,
    force_ascii=False
)

print(f"Berhasil mengekstrak {len(data)} dokumen.")
