# Guard SDK (v1)

Tiny server-side SDK for calling Guard API `/check`.

✅ Designed for backend use (Node, Next.js API routes, server functions)  
🚫 Do not use in browsers (it requires `MASTER_KEY`)

---

## Install / Use

For v1, this SDK can live inside your Guard API repo under `./sdk`.

Import:

```ts
import { GuardClient } from "../sdk/index.js";
```
