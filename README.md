# titulosBlockchain-backend

API para registrar y verificar titulos academicos en una blockchain local.

## Instalacion

```powershell
npm install
npm run keys:generate
npm start
```

La API se ejecuta en `http://localhost:3001`.

## Cifrado del almacenamiento

`data/blockchain.json` se cifra con AES-256-GCM. La clave AES aleatoria se cifra
con RSA-OAEP-SHA256. Las claves se guardan localmente en:

- `keys/public.pem`: necesaria para guardar la blockchain.
- `keys/private.pem`: necesaria para cargar y descifrar la blockchain.

La carpeta `keys/` no se versiona. Conserva una copia segura de la clave privada;
si se pierde, no sera posible recuperar el contenido de `blockchain.json`.

En produccion se pueden indicar otras ubicaciones mediante
`BLOCKCHAIN_PUBLIC_KEY_PATH` y `BLOCKCHAIN_PRIVATE_KEY_PATH`.
