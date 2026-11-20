
import json
from pathlib import Path

# Folder sumber JSON
data_dir = Path("data")

# File output
output_file = data_dir / "collection.json"

# File JSON yang akan digabungkan
json_files = [
    data_dir / "hasil_ekstraksi_arsip_upn.json",
    data_dir / "hasil_ekstraksi_dokumen_akademik.json",
    data_dir / "hasil_ekstraksi_dokumen_survei.json",
    data_dir / "hasil_ekstraksi_renstra.json",
    data_dir / "laporan_kinerja.json"
]

collection = []
doc_counter = 1

for json_file in json_files:

    # Baca file JSON
    with open(json_file, "r", encoding="utf-8") as file:
        documents = json.load(file)

    # Pastikan data berbentuk list
    if not isinstance(documents, list):
        documents = [documents]

    for document in documents:

        # Tambahkan ID otomatis
        document["doc_id"] = f"D{doc_counter}"

        collection.append(document)
        doc_counter += 1

# Simpan menjadi satu collection.json
with open(output_file, "w", encoding="utf-8") as file:
    json.dump(
        collection,
        file,
        ensure_ascii=False,
        indent=4
    )

print(f"Berhasil menggabungkan {len(collection)} dokumen.")
print(f"File tersimpan di: {output_file}")
