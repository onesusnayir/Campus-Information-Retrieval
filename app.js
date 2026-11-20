// ==========================================
// 1. GLOBAL DATA
// ==========================================

let collection = [];
let invertedIndex = {};
let metadata = {};


// ==========================================
// 2. LOAD JSON
// ==========================================

async function loadData() {
    try {
        const [collectionResponse, indexResponse, metadataResponse] =
            await Promise.all([
                fetch("./database/collection.json"),
                fetch("./database/inverted_index.json"),
                fetch("./database/index_metadata.json")
            ]);

        if (!collectionResponse.ok ||
            !indexResponse.ok ||
            !metadataResponse.ok) {
            throw new Error("Gagal membaca file JSON.");
        }

        collection = await collectionResponse.json();
        invertedIndex = await indexResponse.json();
        metadata = await metadataResponse.json();

        document.getElementById("status").textContent =
            `Berhasil memuat ${collection.length} dokumen.`;

    } catch (error) {
        document.getElementById("status").textContent =
            "Gagal memuat data. Jalankan aplikasi melalui local server.";

        document.getElementById("status").className = "error";

        console.error(error);
    }
}


// ==========================================
// 3. PREPROCESSING QUERY
// ==========================================

function preprocess(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}


// ==========================================
// 4. HELPER: MENGAMBIL DOKUMEN
// ==========================================

function getDocument(docId) {
    return collection.find(doc => doc.doc_id === docId);
}

function getPostingList(term) {
    return invertedIndex[term]?.posting_list || [];
}


// ==========================================
// 5. BOOLEAN RETRIEVAL
// ==========================================

// Mengubah query menjadi token.
// Contoh: akademik AND mahasiswa
// Hasil: ["akademik", "AND", "mahasiswa"]

function tokenizeBoolean(query) {
    return query.match(/[a-zA-Z0-9]+|[()]/g) || [];
}


// Parser Boolean dengan prioritas:
// NOT > AND > OR

function booleanRetrieval(query) {
    const tokens = tokenizeBoolean(query);

    if (tokens.length === 0) {
        throw new Error("Query tidak boleh kosong.");
    }

    const operators = new Set(["AND", "OR", "NOT"]);
    let position = 0;

    function parseExpression() {
        let result = parseAnd();

        while (tokens[position]?.toUpperCase() === "OR") {
            position++;
            const right = parseAnd();

            result = union(result, right);
        }

        return result;
    }

    function parseAnd() {
        let result = parseUnary();

        while (tokens[position]?.toUpperCase() === "AND") {
            position++;
            const right = parseUnary();

            result = intersection(result, right);
        }

        return result;
    }

    function parseUnary() {
        const token = tokens[position];

        if (!token) {
            throw new Error("Query tidak lengkap.");
        }

        if (token.toUpperCase() === "NOT") {
            position++;

            const result = parseUnary();
            const allDocuments = new Set(
                collection.map(doc => doc.doc_id)
            );

            return difference(allDocuments, result);
        }

        if (token === "(") {
            position++;

            const result = parseExpression();

            if (tokens[position] !== ")") {
                throw new Error("Kurung tutup tidak ditemukan.");
            }

            position++;
            return result;
        }

        if (token === ")" || operators.has(token.toUpperCase())) {
            throw new Error("Format query Boolean tidak valid.");
        }

        position++;

        return new Set(
            getPostingList(token.toLowerCase())
                .map(item => item.doc_id)
        );
    }

    const result = parseExpression();

    if (position !== tokens.length) {
        throw new Error("Format query Boolean tidak valid.");
    }

    return [...result].map(getDocument).filter(Boolean);
}


// Operasi AND
function intersection(setA, setB) {
    return new Set(
        [...setA].filter(item => setB.has(item))
    );
}


// Operasi OR
function union(setA, setB) {
    return new Set([...setA, ...setB]);
}


// Operasi NOT
function difference(setA, setB) {
    return new Set(
        [...setA].filter(item => !setB.has(item))
    );
}


// ==========================================
// 6. VECTOR SPACE MODEL (VSM)
// ==========================================

function vectorSpaceModel(query) {

    const queryTokens = preprocess(query);

    if (queryTokens.length === 0) {
        throw new Error("Query tidak boleh kosong.");
    }

    const totalDocuments = collection.length;

    // Menghitung TF query
    const queryTF = {};

    queryTokens.forEach(term => {
        queryTF[term] = (queryTF[term] || 0) + 1;
    });

    // Membentuk vector query menggunakan TF-IDF
    const queryVector = {};

    for (const [term, tf] of Object.entries(queryTF)) {

        const termData = invertedIndex[term];

        if (!termData) continue;

        const idf = termData.idf;

        queryVector[term] = tf * idf;
    }

    // Menghitung panjang vector query
    const queryMagnitude = Math.sqrt(
        Object.values(queryVector)
            .reduce((sum, weight) => sum + weight ** 2, 0)
    );

    if (queryMagnitude === 0) {
        return [];
    }

    // Menghitung cosine similarity
    const results = [];

    for (const document of collection) {

        const docId = document.doc_id;

        let dotProduct = 0;
        let documentMagnitudeSquared = 0;

        // Panjang vector dokumen
        for (const [term, termData] of Object.entries(invertedIndex)) {

            const posting = termData.posting_list.find(
                item => item.doc_id === docId
            );

            if (posting) {
                documentMagnitudeSquared += posting.tfidf ** 2;
            }
        }

        // Dot product query dan dokumen
        for (const [term, queryWeight] of Object.entries(queryVector)) {

            const posting = getPostingList(term).find(
                item => item.doc_id === docId
            );

            if (posting) {
                dotProduct += queryWeight * posting.tfidf;
            }
        }

        const documentMagnitude = Math.sqrt(
            documentMagnitudeSquared
        );

        const similarity =
            documentMagnitude === 0
                ? 0
                : dotProduct /
                  (queryMagnitude * documentMagnitude);

        if (similarity > 0) {
            results.push({
                ...document,
                similarity
            });
        }
    }

    // Urutkan berdasarkan similarity tertinggi
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
}


// ==========================================
// 7. MENAMPILKAN HASIL
// ==========================================

function displayResults(results, method, query) {

    const resultsContainer = document.getElementById("results");
    const resultCount = document.getElementById("resultCount");
    const queryDisplay = document.getElementById("queryDisplay");

    queryDisplay.textContent = `Hasil Query "${query}"`
    resultCount.textContent = `${results.length} dokumen`;

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <p class="empty">Dokumen tidak ditemukan.</p>
        `;
        return;
    }

    resultsContainer.innerHTML = results.map(document => {

        const score = method === "vsm"
            ? `<span class="score">
                Similarity: ${(document.similarity * 100).toFixed(2)}%
               </span>`
            : "";

        const categories = Array.isArray(document.kategori_dokumen)
            ? document.kategori_dokumen.join(", ")
            : (document.kategori_dokumen || "-");

        return `
            <div class="document-card">
                <h3>${escapeHTML(document.nama_dokumen || "Tanpa judul")}</h3>

                ${score}

                <p>
                    <strong>ID:</strong>
                    ${escapeHTML(document.doc_id)}
                </p>

                <p>
                    <strong>Kategori:</strong>
                    ${escapeHTML(categories)}
                </p>

                <p>
                    <strong>Tanggal update:</strong>
                    ${escapeHTML(document.tanggal_update || "-")}
                </p>

                <a href="${escapeHTML(document.link_dokumen || "#")}"
                   target="_blank"
                   rel="noopener noreferrer">
                    Lihat Dokumen
                </a>
            </div>
        `;
    }).join("");
}


// Mencegah teks dokumen dianggap sebagai HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


// ==========================================
// 8. PROSES PENCARIAN
// ==========================================

function search() {

    const query = document.getElementById("query").value.trim();

    const method = document.getElementById("method").value;

    const status = document.getElementById("status");

    if (!query) {
        status.textContent = "Masukkan kata kunci pencarian.";
        status.className = "error";
        return;
    }

    try {

        let results;

        if (method === "boolean") {
            results = booleanRetrieval(query);
        } else {
            results = vectorSpaceModel(query);
        }

        status.textContent = `Pencarian menggunakan ${
            method === "boolean"
                ? "Boolean Retrieval"
                : "Vector Space Model"
        } berhasil.`;

        status.className = "";

        displayResults(results, method, query);

    } catch (error) {

        status.textContent = error.message;
        status.className = "error";

        displayResults([], method);

    }
}


// ==========================================
// 9. EVENT LISTENERS
// ==========================================

document.getElementById("searchBtn")
    .addEventListener("click", search);

document.getElementById("query")
    .addEventListener("keydown", event => {
        if (event.key === "Enter") {
            search();
        }
    });

document.getElementById("method")
    .addEventListener("change", event => {

        const hint = document.getElementById("searchHint");

        if (event.target.value === "boolean") {
            hint.textContent =
                "Gunakan operator AND, OR, NOT dan tanda kurung.";
        } else {
            hint.textContent =
                "Masukkan kata kunci biasa untuk mencari dokumen berdasarkan relevansi.";
        }
    });


// ==========================================
// 10. INITIALIZATION
// ==========================================

loadData();