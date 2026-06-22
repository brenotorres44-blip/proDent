// js/storage.js
// Módulo de anexos — Cloudinary (gratuito, sem cartão)
// Arquivos → Cloudinary | Metadados → Firestore
import { db } from "./firebase.js";
import { getClinicaIdSessao } from "./tenant.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth } from "./firebase.js";

const CLOUDINARY_CLOUD_NAME    = "dggdjo87t";
const CLOUDINARY_UPLOAD_PRESET = "ml_default";
const CLOUDINARY_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

export function iconeArquivo(tipo) {
  if (!tipo) return "ti-file";
  if (tipo.startsWith("image/"))  return "ti-photo";
  if (tipo === "application/pdf") return "ti-file-type-pdf";
  if (tipo.includes("word"))      return "ti-file-type-doc";
  if (tipo.includes("excel") || tipo.includes("spreadsheet")) return "ti-file-type-xls";
  if (tipo.startsWith("video/"))  return "ti-video";
  if (tipo.startsWith("audio/"))  return "ti-music";
  return "ti-file";
}

export function formatarTamanho(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024)         return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function uploadAnexo(pacienteId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const clinicaId = getClinicaIdSessao();
    const formData  = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", `dentalpro/${clinicaId}/${pacienteId}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_UPLOAD_URL, true);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) { reject(new Error("Falha no upload")); return; }
      const data = JSON.parse(xhr.responseText);
      const metaRef = collection(db, "clinica", clinicaId, "pacientes", pacienteId, "anexos");
      const docRef  = await addDoc(metaRef, {
        nome:         file.name,
        tipo:         file.type,
        tamanho:      file.size,
        url:          data.secure_url,
        publicId:     data.public_id,
        resourceType: data.resource_type,
        uploadadoEm:  serverTimestamp(),
        uploadadoPor: auth.currentUser?.uid || "sistema"
      });
      resolve({ id: docRef.id, nome: file.name, tipo: file.type, tamanho: file.size, url: data.secure_url });
    };

    xhr.onerror = () => reject(new Error("Erro de rede"));
    xhr.send(formData);
  });
}

export async function listarAnexos(pacienteId, clinicaId) {
  const cid = clinicaId || getClinicaIdSessao();
  const q   = query(
    collection(db, "clinica", cid, "pacientes", pacienteId, "anexos"),
    orderBy("uploadadoEm", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function excluirAnexo(pacienteId, anexoId, _publicId, clinicaId) {
  const cid = clinicaId || getClinicaIdSessao();
  await deleteDoc(doc(db, "clinica", cid, "pacientes", pacienteId, "anexos", anexoId));
}
