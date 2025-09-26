let CartaMensaje, EstadoP, NombreArchivoP;
let modelo, knn;
let modeloListo = false;
const API_BASE = 'https://guatepath-api-service-cparavh2h4ahhrhv.azurewebsites.net';

// p5 image + canvas
let imgActual = null;           // p5.Image
let mainCanvasElt = null;       // HTMLCanvasElement
let RelacionImagen = 1;

/* ========= MAPEOS DE ETIQUETAS =========
   Algunos JSON de KNN usan índices numéricos. Para mostrar NOMBRES correctos:
   - mapStringToIndex: "APOPTOSIS" -> 0
   - mapIndexToString: 0 -> "APOPTOSIS"
*/
let mapStringToIndex = {};
let mapIndexToString = {};
let nextLabelIndex = 0; // sugerencia de índice para nuevas etiquetas de usuario

/* ---------- Utils ---------- */
function setEstado(msg){ if(EstadoP) EstadoP.textContent = msg; }
function setCarta(msg){ if(CartaMensaje) CartaMensaje.innerText = msg; }

/* ======================= SETUP / DRAW ======================= */
function setup() {
  const cont = document.getElementById('micanva');
  CartaMensaje = document.getElementById('CartaMensaje');
  EstadoP = document.getElementById('Estado');
  NombreArchivoP = document.getElementById('NombreArchivo');

  setCarta("Cargando APP...");
  setEstado("Cargando MobileNet...");

  const ancho = Math.max(320, cont?.offsetWidth || 0);
  const alto  = Math.max(200, Math.floor(ancho * 0.56));
  const canvas = createCanvas(ancho, alto);
  canvas.parent("micanva");
  mainCanvasElt = canvas.elt;

  // ml5
  modelo = ml5.featureExtractor('MobileNet', ModeloListo);
  knn    = ml5.KNNClassifier();

  // Cargar imagen local
  document.getElementById('SeleccionarImagenBoton')?.addEventListener('click', (e)=>{
    e.preventDefault();
    const inp = document.getElementById('InputImagen');
    if (!inp) return;
    inp.value = null;
    inp.click();
  });
  document.getElementById('InputImagen')?.addEventListener('change', onSeleccionImagen);

  // Entrenar con texto
  document.getElementById('TextBoxBoton')?.addEventListener('click', (e)=>{
    e.preventDefault();
    const tb = document.getElementById('TextBox');
    const label = (tb?.value || '').trim();
    if (!label) { setEstado('Ingresa una etiqueta.'); return; }
    ensureLabelInMaps(label);
    EntrenarKnn(label);
    tb.value = '';
    if (window.M && M.updateTextFields) M.updateTextFields();
    else document.querySelector('label[for="TextBox"]')?.classList.remove('active');
  });

  // Botones predefinidos (idénticos a tu index)
  document.querySelectorAll('.BotonEntrenar').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      const label = el.innerText.trim();
      ensureLabelInMaps(label);
      EntrenarKnn(label);
    });
  });

  // Guardar / Cargar / Limpiar (mismo flujo que tu sketch)
  document.getElementById('SalvarBoton')?.addEventListener('click', (e)=>{ e.preventDefault(); GuardadNeurona(); });
  document.getElementById('CargarBoton')?.addEventListener('click', (e)=>{ e.preventDefault(); CargarNeurona(); });
  document.getElementById('LimpiarBoton')?.addEventListener('click', (e)=>{ e.preventDefault(); LimpiarKnn(); });
}

function draw() {
  background("#b2dfdb");

  if (imgActual) {
    const ratio = width / imgActual.width;
    const dibW  = width;
    const dibH  = Math.max(1, Math.floor(imgActual.height * ratio));
    image(imgActual, 0, 0, dibW, dibH);
    if (Math.abs(height - dibH) > 1) resizeCanvas(width, dibH, true);
  } else {
    noStroke(); fill(0, 0, 0, 120);
    textAlign(CENTER, CENTER); textSize(16);
    text('Selecciona una imagen para entrenar o clasificar.', width / 2, height / 2);
  }
}

function windowResized() {
  const cont = document.getElementById('micanva');
  const ancho = Math.max(320, cont?.offsetWidth || 0);
  const alto  = imgActual ? Math.floor(ancho * RelacionImagen) : height;
  resizeCanvas(ancho, alto, true);
}

function ModeloListo() {
  modeloListo = true;
  setCarta("Modelo Listo");
  setEstado("MobileNet listo. Carga una imagen para entrenar o clasificar.");
}

/* ======================= CARGA DE IMAGEN ======================= */
function onSeleccionImagen(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;

  const url = URL.createObjectURL(f);
  NombreArchivoP.textContent = `Imagen: ${f.name}`;

  loadImage(url,
    (img) => {
      imgActual = img;
      const cont = document.getElementById('micanva');
      const ancho = Math.max(320, cont?.offsetWidth || 0);
      const ratio = img.height / img.width;
      RelacionImagen = ratio;
      const alto = Math.max(100, Math.floor(ancho * ratio));
      resizeCanvas(ancho, alto, true);
      setEstado('Imagen lista. Puedes entrenar o clasificar.');

      // Clasificación automática si ya hay modelo
      if (knn && knn.getNumLabels && knn.getNumLabels() > 0) {
        classifyCurrentImage();
      }
    },
    (err) => { console.error('Error cargando imagen:', err); setEstado('Error cargando imagen.'); }
  );
}

/* ======================= ENTRENAMIENTO (imagen completa) ======================= */
function getCanvasForInfer() {
  // Fuente estable para tf.browser.fromPixels
  if (!mainCanvasElt || !mainCanvasElt.width || !mainCanvasElt.height) return null;
  return mainCanvasElt;
}

function EntrenarKnn(label) {
  if (!modeloListo) { setEstado('Espera a que MobileNet esté listo.'); return; }
  if (!imgActual)   { setEstado('Primero selecciona una imagen.');   return; }

  const srcEl = getCanvasForInfer();
  if (!srcEl) { setEstado('Canvas no listo para inferencia.'); return; }

  requestAnimationFrame(() => {
    try {
      const features = modelo.infer(srcEl);   // imagen completa desde el canvas
      knn.addExample(features, label);
      setCarta(`Entrenado con "${label}" (imagen completa)`);

      // Clasificar inmediatamente para ver efecto
      classifyCurrentImage();
    } catch (err) {
      console.error('Error en infer/addExample:', err);
      setEstado('Error procesando la imagen (ver consola).');
    }
  });
}

/* ======================= CLASIFICACIÓN AUTO ======================= */
function classifyCurrentImage() {
  if (!modeloListo) { setEstado('Modelo no listo.'); return; }
  if (!imgActual)   { setEstado('No hay imagen en pantalla.'); return; }
  if (!(knn && knn.getNumLabels && knn.getNumLabels() > 0)) {
    setEstado('El clasificador no tiene ejemplos cargados. Entrena o carga la neurona.');
    return;
  }

  const srcEl = getCanvasForInfer();
  if (!srcEl) { setEstado('Canvas no listo para inferencia.'); return; }

  requestAnimationFrame(() => {
    const feats = modelo.infer(srcEl);
    knn.classify(feats, (error, result) => {
      if (error) { console.error(error); setEstado('Error clasificando (ver consola).'); return; }

      // Normalizar etiqueta (numérica o string) y confidencias
      const normalized = normalizeKNNResult(result);
      setCarta(`${normalized.label} - ${normalized.confidence}%`);
    });
  });
}

/* ===== Normalización de salida de KNN para mostrar NOMBRES ===== */
function normalizeKNNResult(result) {
  // result: { label, confidencesByLabel: {key:score,...} }
  let label = result?.label;
  const confs = result?.confidencesByLabel || {};

  // Si label es numérico o string numérica => traducir con mapIndexToString
  if (label !== undefined && label !== null) {
    const keyStr = String(label);
    if (isFinite(+keyStr) && mapIndexToString.hasOwnProperty(+keyStr)) {
      label = mapIndexToString[+keyStr];
    }
  }

  // Si las claves de confidences parecen índices, tradúcelas y elige top-1
  let bestLabel = null, bestScore = -1;
  for (const k in confs) {
    const score = confs[k] ?? 0;
    let name = k;

    if (isFinite(+k) && mapIndexToString.hasOwnProperty(+k)) {
      name = mapIndexToString[+k];
    }
    // Si existen nombres directos en confs, respétalos
    if (!isFinite(+k) && mapStringToIndex.hasOwnProperty(k)) {
      name = k;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLabel = name;
    }
  }

  // Decide etiqueta final priorizando consistencia con top-1
  const finalLabel = bestLabel || (typeof label === 'string' ? label : String(label));
  const finalConf  = Math.max(0, Math.round((bestScore || 0) * 100));

  return { label: finalLabel, confidence: finalConf };
}

/* ===== Registrar etiquetas nuevas en los mapas ===== */
function ensureLabelInMaps(name) {
  if (mapStringToIndex.hasOwnProperty(name)) return;
  // asigna índice disponible
  const idx = nextLabelIndex++;
  mapStringToIndex[name] = idx;
  mapIndexToString[idx]  = name;
}

/* ===== Reconstruir mapas desde JSON del backend ===== */
function rebuildMapsFromModelJson(modeloJson) {
  mapStringToIndex = {};
  mapIndexToString = {};
  nextLabelIndex   = 0;

  // Preferimos dataset: { "0": {label: "APOPTOSIS", ...}, ... }
  const ds = modeloJson?.dataset || {};
  const keys = Object.keys(ds).sort((a,b)=> (+a)-(+b));

  keys.forEach(k => {
    const idx = parseInt(k, 10);
    const name = ds[k]?.label;
    if (Number.isInteger(idx) && typeof name === 'string') {
      mapIndexToString[idx] = name;
      mapStringToIndex[name] = idx;
      nextLabelIndex = Math.max(nextLabelIndex, idx + 1);
    }
  });

  // Fallback si existiera un arreglo labels
  if ((!keys.length) && Array.isArray(modeloJson?.labels)) {
    modeloJson.labels.forEach((name, i) => {
      if (typeof name === 'string') {
        mapIndexToString[i] = name;
        mapStringToIndex[name] = i;
        nextLabelIndex = Math.max(nextLabelIndex, i + 1);
      }
    });
  }
}

/* ======================= PERSISTENCIA (DB) ======================= */
function GuardadNeurona() {
  if (!(knn && knn.getNumLabels && knn.getNumLabels() > 0)) {
    setCarta("No hay ejemplos para guardar.");
    return;
  }
  console.log("Guardando la neurona localmente y en la base de datos...");

  const originalCreate = window.URL.createObjectURL;
  window.URL.createObjectURL = function(blob) {
    const reader = new FileReader();
    reader.onload = function() {
      const modeloJsonTexto = reader.result;
      window.URL.createObjectURL = originalCreate;

      fetch(`${API_BASE}/guardar-modelo`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "modelo_knn_" + new Date().toISOString(),
          modeloJson: modeloJsonTexto
        })
      })
      .then(res => res.text().then(t => ({ ok: res.ok, status: res.status, text: t })))
      .then(({ ok, status, text }) => {
        if (ok) {
          console.log("Modelo guardado correctamente en base de datos.");
          setCarta("Neurona guardada (archivo y base de datos).");
        } else {
          console.error("Error al guardar en la base de datos. Código:", status, text);
          setCarta("Guardado local ok; error guardando en base de datos.");
        }
      })
      .catch(err => {
        console.error("Error al enviar modelo a la base de datos:", err);
        setCarta("Guardado local ok; error de red guardando en base de datos.");
      });
    };
    reader.readAsText(blob);
    return originalCreate.call(window.URL, blob);
  };

  knn.save('NeuronaKNN');
}

async function CargarNeurona() {
  console.log("Iniciando carga del modelo desde la base de datos...");
  try {
    const res = await fetch(`${API_BASE}/cargar-modelo-ultimo`);
    if (!res.ok) throw new Error("No se pudo obtener el modelo desde el servidor.");
    const modeloJson = await res.json();

    console.log("Modelo recibido desde el backend:", modeloJson);

    // Reconstruir mapas de etiquetas ANTES de cargar al KNN
    rebuildMapsFromModelJson(modeloJson);

    // Crear Blob/URL temporal y cargar en KNN
    const blob = new Blob([JSON.stringify(modeloJson)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);

    knn.load(url, () => {
      console.log("✅ Neurona cargada correctamente desde la base de datos.");
      setCarta("Neurona cargada desde la base de datos");
      URL.revokeObjectURL(url);

      // Si hay imagen, clasificar automáticamente
      if (imgActual) classifyCurrentImage();

      // Log informativo
      console.log("Etiquetas (idx->name):", mapIndexToString);
      console.log("Número de etiquetas en KNN:", knn.getNumLabels());
    });

  } catch (error) {
    console.error("❌ Error al cargar modelo:", error);
    setCarta("Error cargando neurona desde la base de datos");
  }
}

function LimpiarKnn() {
  if (knn && knn.clearAllLabels) knn.clearAllLabels();
  setCarta("Neurona Borrada");
}
