// sketch.js
// === Auth helpers (JWT) ===
const API_BASE = 'https://guatepath-api-service-cparavh2h4ahhrhv.azurewebsites.net';

function getToken() {
  return localStorage.getItem('token') || '';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

async function requireAuth() {
  const token = getToken();
  if (!token) return logout();
  try {
    const r = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return logout();
    const { user } = await r.json();
    const who = document.getElementById('whoami');
    if (who) who.textContent = `${user.username} (${user.rol})`;
    return user;
  } catch {
    return logout();
  }
}

// fetch con Authorization; devuelve el Response (para elegir .json() o .text())
async function authFetch(path, init = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${getToken()}`
    }
  });
  if (r.status === 401) {
    logout();
    throw new Error('401 unauthorized');
  }
  return r;
}

// Helpers convenientes si necesitas JSON directo
async function authGetJson(path) {
  const r = await authFetch(path);
  return r.json();
}
async function authPostJson(path, body) {
  const r = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

// (opcional) exponer logout para un botón en la UI
window.appLogout = logout;




let Camara, CartaMensaje, knn, modelo;
let Clasificando = false, CargandoNeurona = false, RelacionCamara;

function setup() {
  const obtiene = document.getElementById('micanva');
  CartaMensaje = document.getElementById('CartaMensaje');
  CartaMensaje.innerText = "Cargando APP...";
  const ancho = obtiene.offsetWidth;

  Camara = createCapture(VIDEO);
  Camara.hide();
  RelacionCamara = Camara.height / Camara.width;
  const alto = ancho * RelacionCamara;
  const canvas = createCanvas(ancho, alto);
  canvas.parent("micanva");

  modelo = ml5.featureExtractor('MobileNet', ModeloListo);
  knn = ml5.KNNClassifier();

  selectAll(".BotonEntrenar").forEach(btn =>
    btn.mousePressed(() => EntrenarKnn(btn.elt.innerText))
  );
  select("#SalvarBoton").mousePressed(GuardadNeurona);
  select("#CargarBoton").mousePressed(CargarNeurona);
  select("#TextBoxBoton").mousePressed(EntrenarTexBox);
  select("#LimpiarBoton").mousePressed(LimpiarKnn);
  select("#inputCargarArchivo").mousePressed(cargarArchivoLocal);
}

function draw() {
  background("#b2dfdb");
  image(Camara, 0, 0, width, height);

  if (knn.getNumLabels() > 0 && !Clasificando) {
    setInterval(clasificar, 500);
    Clasificando = true;
  }

  const rel2 = Camara.height / Camara.width;
  if (rel2 !== RelacionCamara) {
    const ancho = width, alto = ancho * rel2;
    RelacionCamara = rel2;
    resizeCanvas(ancho, alto, true);
  }
}

function ModeloListo() {
  console.log("Modelo Listo");
  CartaMensaje.innerText = "Modelo Listo";
}

function EntrenarKnn(label) {
  const img = modelo.infer(Camara);
  knn.addExample(img, label);
  console.log("Entrenado con", label);
}

function clasificar() {
  if (!Clasificando) return;

  const img = modelo.infer(Camara);
  knn.classify(img, (error, result) => {
    if (error) return console.error(error);

    let label = result.label;

    // Si el label es un índice numérico, traducir al nombre original
    if (knn.mapIndexToString && knn.mapIndexToString[label]) {
      label = knn.mapIndexToString[label];
    }

    const score = result.confidencesByLabel[label]
      ? Math.ceil(result.confidencesByLabel[label] * 100)
      : 0;

    console.log("Predicción:", result);
    CartaMensaje.innerText = `${label} - ${score}%`;
  });
}

function ClasificarVideo() {
  if (!CargandoNeurona) return; // Asegura que el modelo ya está cargado
  clasificar();                 // Clasifica el frame actual
  setTimeout(ClasificarVideo, 200); // Llama de nuevo en 200ms (5 veces por segundo)
}


function obtenerEtiquetasDelModelo(modeloJson) {
  const etiquetas = [];

  const dataset = modeloJson.dataset;
  if (!dataset) return etiquetas;

  for (let key in dataset) {
    const entrada = dataset[key];
    if (entrada.label !== undefined) {
      etiquetas.push({
        indice: key,
        etiqueta: entrada.label
      });
    }
  }

  return etiquetas;
}

function asignarEtiquetas(etiquetas) {
  knn.mapStringToIndex = {};
  knn.mapIndexToString = {};
  etiquetas.forEach((etiqueta, i) => {
    knn.mapStringToIndex[etiqueta] = i;
    knn.mapIndexToString[i] = etiqueta;
  });
}

function EntrenarTexBox() {
  const img = modelo.infer(Camara);
  const label = select("#TextBox").value();
  if (label) knn.addExample(img, label);
}

function GuardadNeurona() {
  if (Clasificando) {
    console.log("Guardando la neurona localmente y en la base de datos...");

    // Guardar localmente
    knn.save('NeuronaKNN');

    // También preparar el modelo para la base de datos
    // knn.save genera un archivo con un "download", así que lo interceptaremos con un truco:

    const originalDownload = window.URL.createObjectURL;
    window.URL.createObjectURL = function(blob) {
      const reader = new FileReader();
      reader.onload = function() {
        const modeloJson = reader.result;

        // Restauramos el método original para no afectar otras cosas
        window.URL.createObjectURL = originalDownload;

        // Enviar a la base de datos
        fetch(`${API_BASE}/guardar-modelo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            nombre: "modelo_knn_" + new Date().toISOString(),
            modeloJson: modeloJson
          })
        })
        .then(res => {
          if (res.ok) {
            console.log(" Modelo guardado correctamente en base de datos.");
          } else {
            console.error(" Error al guardar en la base de datos. Código:", res.status);
          }
          return res.text();
        })
        .then(data => console.log(" Respuesta servidor:", data))
        .catch(error => {
          console.error(" Error al enviar modelo a la base de datos:", error);
        });
      };

      reader.readAsText(blob);

      // Retorna el original para que el navegador aún lo descargue
      return originalDownload.call(window.URL, blob);
    };

    // Llamamos de nuevo a knn.save para disparar el nuevo behavior
    knn.save('NeuronaKNN');
  }
}

async function CargarNeurona() {
  console.log(" Iniciando carga del modelo desde la base de datos...");

  try {
    const res = await fetch(`${API_BASE}/cargar-modelo-ultimo`);
    if (!res.ok) throw new Error(" No se pudo obtener el modelo desde el servidor.");

    const modeloJson = await res.json();
    console.log(" Modelo recibido desde el backend:", modeloJson);

    const blob = new Blob([JSON.stringify(modeloJson)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Cargar el modelo KNN desde la URL
    knn.load(url, () => {
      console.log(" ✅ Neurona cargada correctamente desde la base de datos.");
      CartaMensaje.innerText = "Neurona cargada desde la base de datos";
      CargandoNeurona = true;
      Clasificando = true;

      // 🔄 Extraer y asignar etiquetas aquí, después de cargar
      const etiquetas = Object.keys(modeloJson.dataset).map((key) => ({
        indice: parseInt(key),
        etiqueta: modeloJson.dataset[key].label
      }));

      // Inicializar mapas si no existen
      if (!knn.mapStringToIndex) knn.mapStringToIndex = {};
      if (!knn.mapIndexToString) knn.mapIndexToString = {};

      etiquetas.forEach(e => {
        knn.mapStringToIndex[e.etiqueta] = e.indice;
        knn.mapIndexToString[e.indice] = e.etiqueta;
      });

      // Liberamos la URL temporal
      URL.revokeObjectURL(url);

      // Comenzamos la clasificación automática (esto usa MobileNet, que ya fue cargado antes)
      ClasificarVideo();

      // Mostrar info extra en consola
      console.log(" Etiquetas cargadas:", etiquetas.map(e => e.etiqueta));
      console.log(" Número de etiquetas:", knn.getNumLabels());
    });

  } catch (error) {
    console.error(" ❌ Error al cargar modelo:", error);
    CartaMensaje.innerText = "Error cargando neurona desde la base de datos";
  }
}

// Añade esta función al final o donde tengas las demás funciones relacionadas a carga
function cargarArchivoLocal() {
  const inputFile = document.createElement('input');
  inputFile.type = 'file';
  inputFile.accept = '.json';

  inputFile.onchange = (event) => {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(e) {
      try {
        const contenido = e.target.result;
        const modeloJson = JSON.parse(contenido);

        const blob = new Blob([JSON.stringify(modeloJson)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        knn.load(url, () => {
          console.log("✅ Neurona cargada desde archivo local");
          CartaMensaje.innerText = "Neurona cargada desde archivo local";

          // Extraer y asignar etiquetas igual que en CargarNeurona
          const etiquetas = Object.keys(modeloJson.dataset).map((key) => ({
            indice: parseInt(key),
            etiqueta: modeloJson.dataset[key].label
          }));

          if (!knn.mapStringToIndex) knn.mapStringToIndex = {};
          if (!knn.mapIndexToString) knn.mapIndexToString = {};

          etiquetas.forEach(e => {
            knn.mapStringToIndex[e.etiqueta] = e.indice;
            knn.mapIndexToString[e.indice] = e.etiqueta;
          });

          CargandoNeurona = true;
          Clasificando = true;

          URL.revokeObjectURL(url);

          ClasificarVideo();

          console.log("Etiquetas cargadas:", etiquetas.map(e => e.etiqueta));
          console.log("Número de etiquetas:", knn.getNumLabels());
        });
      } catch (error) {
        console.error("❌ Error cargando archivo local:", error);
        CartaMensaje.innerText = "Error cargando archivo local";
      }
    };
    lector.readAsText(archivo);
  };

  inputFile.click();
}

function LimpiarKnn() {
  if (!Clasificando) return;
  clearInterval(clasificar);
  knn.clearAllLabels();
  Clasificando = false;
  CartaMensaje.innerText = "Neurona borrada";
}
