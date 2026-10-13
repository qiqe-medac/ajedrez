# Chess — ajedrez en el navegador

Aplicación web de ajedrez para dos personas en el mismo dispositivo. Presenta un tablero interactivo y permite jugar una partida local desde un navegador moderno.

## Funcionalidades

- Mover las piezas haciendo clic en una pieza y después en una casilla de destino, o arrastrándola.
- Mostrar los movimientos legales disponibles y realizar capturas válidas.
- Aplicar las reglas y comprobar el estado de la partida con `chess.js` 1.4.0, incluida la detección de jaque, jaque mate y tablas.
- Coronar automáticamente los peones que alcanzan la última fila a dama.
- Consultar por separado las casillas atacadas por las piezas blancas o negras, con un mapa de calor y el número de atacantes por casilla.
- Girar el tablero; las coordenadas exteriores se actualizan para seguir la orientación visible.
- Ver un reloj ascendente para cada bando durante su turno.
- Reiniciar la partida.
- Usar una interfaz adaptable a escritorio y móvil, con piezas SVG locales.

## Tecnologías

El proyecto utiliza HTML5, CSS3 y JavaScript vanilla. No requiere Node.js, npm, frameworks ni backend. La aplicación carga `chess.js` como módulo ESM desde jsDelivr, por lo que se necesita conexión a Internet para iniciar la partida. Las piezas se cargan desde la carpeta local `pieces/`.

## Cómo abrir

Como JavaScript importa módulos, sirve la carpeta `ajedrez` mediante un servidor de archivos estáticos local o publicado. Por ejemplo, puedes abrir `index.html` con la extensión Live Server de Visual Studio Code. No es necesario instalar paquetes.

## Estructura

- `index.html`: estructura de la página y controles de la partida.
- `css/style.css`: estilos, tablero y diseño responsive.
- `js/script.js`: estado de la partida, interacción, controles y reloj.
- `pieces/`: archivos SVG de las doce piezas.

Los SVG incluidos pertenecen al conjunto Maestro de [lichess-org/lila](https://github.com/lichess-org/lila/tree/master/public/piece/maestro). Consulta [pieces/README.md](pieces/README.md) para la atribución y licencia.