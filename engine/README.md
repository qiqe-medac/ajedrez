# Stockfish.js

Esta carpeta incluye la distribución para navegador **Stockfish.js 18.0.8 lite de un hilo**, descargada del paquete npm [`stockfish@18.0.8`](https://www.npmjs.com/package/stockfish/v/18.0.8) publicado por [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).

- `stockfish-18-lite-single.js`: Worker UCI para navegador.
- `stockfish-18-lite-single.wasm`: motor WebAssembly requerido por el Worker.
- `Copying.txt`: licencia GNU GPL versión 3 del motor.

Los dos archivos de ejecución deben permanecer juntos para que el Worker encuentre el WASM usando la ruta relativa. La aplicación no modifica esos archivos; los inicia bajo demanda y reutiliza el Worker durante la sesión. El código del motor se distribuye bajo GPLv3. Consulta `Copying.txt` y la fuente enlazada arriba para los términos y el código correspondiente.
