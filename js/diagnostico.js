let Camara, CartaMensaje, knn, modelo;
let Clasificando = false, CargandoNeurona = false;
let intervaloClasificacion;

let vozActivada = true, volumenVoz = 0.5, velocidadVoz = 1;
let UltimoTexto = "";
const API_BASE = 'https://guatepath-api-service-cparavh2h4ahhrhv.canadacentral-01.azurewebsites.net';

// Setup principal
function setup() {
  const contenedor = document.getElementById('canvas-container');
  CartaMensaje = document.getElementById('CartaMensaje');
  CartaMensaje.innerText = "Cargando APP...";

  // Creamos el canvas con un tamaño inicial genérico, el CSS lo redimensionará
  const canvas = createCanvas(100, 100);
  canvas.parent("canvas-container");
  
  Camara = createCapture(VIDEO, () => {
    console.log("Cámara iniciada, esperando carga de datos...");
  });

  // Esperamos que el video cargue datos
  Camara.elt.addEventListener('loadeddata', () => {
    console.log("Video cargado, modelo listo para clasificar");

    // Redimensionamos el canvas con las dimensiones nativas de la cámara.
    // Esto es vital para que CSS sepa la relación de aspecto original
    // y no estire la imagen.
    resizeCanvas(Camara.width, Camara.height);

    // Aquí ya se puede comenzar a clasificar
    if (knn.getNumLabels() > 0) {
      Clasificando = true;
      ClasificarVideo();  // iniciar ciclo de clasificación
    }
  });

  Camara.hide();

  modelo = ml5.featureExtractor('MobileNet', ModeloListo);
  knn = ml5.KNNClassifier();

  // Configuración voz (agregar aquí):
  document.getElementById("activarVoz").addEventListener("change", e => {
    vozActivada = e.target.checked;
  });
  document.getElementById("volumenVoz").addEventListener("input", e => {
    volumenVoz = parseFloat(e.target.value);
  });
  document.getElementById("velocidadVoz").addEventListener("input", e => {
    velocidadVoz = parseFloat(e.target.value);
  });
}

// Draw - Bucle principal
function draw() {
  // Voltear la imagen horizontalmente para que se sienta como un espejo
  if (Camara.width > 0 && Camara.height > 0) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(Camara, 0, 0, width, height);
    pop();
  }
}

// Ya no necesitamos esta función, el CSS se encarga del redimensionamiento.
function windowResized() {
  const contenedor = document.getElementById('canvas-container');
  const nuevoAncho = contenedor.offsetWidth;
  const nuevoAlto = nuevoAncho * (Camara.height / Camara.width);
  resizeCanvas(nuevoAncho, nuevoAlto);
}

function ModeloListo() {
  console.log("Modelo Listo");
  CartaMensaje.innerText = "Modelo Listo";
  CargarNeurona();
}

function clasificar() {
  if (!Clasificando || !CargandoNeurona) return; // Asegura que todo esté cargado

  const img = modelo.infer(Camara);
  knn.classify(img, (error, result) => {
    if (error) {
      console.error(error);
      return;
    }

    let label = result.label;

    // AHORA SÍ: Traducimos el índice numérico a la etiqueta original
    if (knn.mapIndexToString && knn.mapIndexToString[label]) {
      label = knn.mapIndexToString[label];
    }
    
    const score = result.confidencesByLabel[label]
      ? Math.ceil(result.confidencesByLabel[label] * 100)
      : 0;

    console.log("Predicción:", result);
    CartaMensaje.innerText = `${label} - ${score}%`;

    if (vozActivada && UltimoTexto !== label + score) {
      const textoAVoz = `${label} en un ${score} por ciento`;
      leerVoz(textoAVoz);
      UltimoTexto = label + score;
    }
  });
}

function ClasificarVideo() {
  // Llama a la función de clasificación y luego se llama a sí misma
  clasificar();
  intervaloClasificacion = setTimeout(ClasificarVideo, 200);
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

// Carga del modelo desde backend
async function CargarNeurona() {
  console.log("Iniciando carga del modelo desde la base de datos...");

  try {
    const res = await fetch(`${API_BASE}/cargar-modelo-ultimo`);
    if (!res.ok) throw new Error("No se pudo obtener el modelo desde el servidor.");

    const modeloJson = await res.json();
    console.log("Modelo recibido desde el backend:", modeloJson);

    const blob = new Blob([JSON.stringify(modeloJson)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Cargar el modelo KNN desde la URL
    knn.load(url, () => {
      console.log(" Neurona cargada correctamente desde la base de datos.");
      CartaMensaje.innerText = "Neurona cargada desde la base de datos";
      CargandoNeurona = true;
      Clasificando = true;

      // Extraer y asignar etiquetas aquí, después de cargar
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

      // Comenzamos la clasificación automática
      ClasificarVideo();

      // Mostrar info extra en consola
      console.log("Etiquetas cargadas:", etiquetas.map(e => e.etiqueta));
      console.log("Número de etiquetas:", knn.getNumLabels());
    });

  } catch (error) {
    console.error("Error al cargar modelo:", error);
    CartaMensaje.innerText = "Error cargando neurona desde la base de datos";
  }
}

// Función para lectura de voz
function leerVoz(texto) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(texto);
  msg.volume = volumenVoz;
  msg.rate = velocidadVoz;
  msg.lang = 'es-ES';
  window.speechSynthesis.speak(msg);
}