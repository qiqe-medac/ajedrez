# Chess — ajedrez en el navegador

**Sitio publicado:** [ajedrez-inky.vercel.app](https://ajedrez-inky.vercel.app/)

Este proyecto es un **Estudio de Ajedrez para aprender y analizar posiciones**. Presenta un tablero interactivo para jugar y explorar posiciones desde un navegador moderno.

## Funcionalidades

- Mover las piezas haciendo clic en una pieza y después en una casilla de destino, o arrastrándola.
- Mostrar los movimientos legales disponibles y realizar capturas válidas.
- Aplicar las reglas y comprobar el estado de la partida con `chess.js` 1.4.0, incluida la detección de jaque, jaque mate y tablas.
- Coronar automáticamente los peones que alcanzan la última fila a dama.
- Consultar por separado las casillas atacadas por las piezas blancas o negras, con un mapa de calor y el número de atacantes por casilla.
- Girar el tablero; las coordenadas exteriores se actualizan para seguir la orientación visible.
- Ver un reloj ascendente para cada bando durante su turno.
- Reiniciar la partida.
- Guardar la posición actual o la posición editable como archivo de texto `.fen`, sin enviar datos a un servidor.
- Cargar archivos FEN locales; en Juego se validan antes de sustituir la partida y, si no puede iniciarse, se ofrece abrirlos en Modo Diseño.
- Crear posiciones personalizadas en Modo Diseño: colocar piezas de ambos colores, arrastrarlas, eliminarlas, vaciar el tablero o restaurar la posición inicial.
- Validar reyes, jaques, jaque mate, ahogado y movimientos legales antes de iniciar una partida desde una posición editada.
- Analizar la posición actual o una posición personalizada con Stockfish.js y consultar hasta tres variantes con evaluación, secuencia SAN y opción para aplicar solo la primera jugada.
- Elegir el bando que juega primero. La validación estricta avisa de que el editor no conserva historial y no puede certificar la legalidad histórica de una posición.
- Usar una interfaz adaptable a escritorio y móvil, con piezas SVG locales.

## Tecnologías

El proyecto utiliza HTML5, CSS3 y JavaScript vanilla. No requiere Node.js, npm, frameworks ni backend. La aplicación carga `chess.js` como módulo ESM desde jsDelivr, por lo que se necesita conexión a Internet para iniciar la partida. Stockfish.js 18.0.8 lite de un hilo se carga bajo demanda desde `engine/` y se ejecuta en un Web Worker; el JavaScript y WASM ocupan unos 7,3 MB en total. El motor incluye su licencia GPLv3 en `engine/Copying.txt`; consulta `engine/README.md` para la atribución y la fuente. Las piezas se cargan desde la carpeta local `pieces/`. FEN conserva la posición, el turno, los derechos de enroque, la casilla al paso y los contadores; no almacena el historial completo ni el tiempo de los relojes.

## Cómo abrir

Como JavaScript importa módulos, sirve la carpeta `ajedrez` mediante un servidor de archivos estáticos local o publicado. Por ejemplo, puedes abrir `index.html` con la extensión Live Server de Visual Studio Code. No es necesario instalar paquetes.

## Estructura

- `index.html`: estructura de la página y controles de la partida.
- `css/style.css`: estilos, tablero y diseño responsive.
- `js/script.js`: estado de la partida, interacción, controles y reloj.
- `engine/`: compilación para navegador de Stockfish.js y su licencia.
- `pieces/`: archivos SVG de las doce piezas.

Los SVG incluidos pertenecen al conjunto Maestro de [lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/piece/maestro). Consulta [pieces/README.md](pieces/README.md) para la atribución y licencia.
