# Sincronización en la Nube y Autenticación con Firebase Firestore para Diario de Trading MNQ & MGC

Integración de persistencia multi-dispositivo y autenticación con Firebase Firestore y Google Auth, garantizando la preservación total de las fórmulas existentes, migración segura de datos locales sin duplicados, retención de respaldos y cero costos imprevistos.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Compromisos y Confirmaciones Garantizadas para la Ejecución:**
> 1. **Cero impacto en funciones y fórmulas**: Se conservan intactas todas las fórmulas (promedio ponderado, hasta 6 entradas por trade bajo un solo ID, PnL bruto y neto, MNQ=$2/pt, MGC=$10/pt, riesgo inicial y múltiplo R), así como el diseño oscuro profesional en español.
> 2. **Migración segura y sin duplicados**: Las operaciones de `localStorage` se migrarán a Firestore utilizando su ID único (`TRD-YYYYMMDD-XXX`) como clave de documento; no habrá duplicación y el almacenamiento local no se borrará, quedando como respaldo offline permanente.
> 3. **Seguridad y privacidad total (Zero-Trust)**: Reglas en `firestore.rules` que validan `request.auth.uid == resource.data.userId`, haciendo imposible que otro usuario lea o modifique tus datos.
> 4. **Sincronización PC y celular**: Al iniciar sesión con tu cuenta de Google en cualquier navegador de tu ordenador o teléfono, tendrás acceso instantáneo a tus datos sincronizados en tiempo real.
> 5. **Mantenimiento del sistema de respaldos**: La descarga e importación de archivos de respaldo JSON y la exportación a CSV compatible con Excel continuarán funcionando exactamente igual.
> 6. **Costo $0 y configuración transparente**: Todo opera bajo el nivel gratuito Spark de Firebase (sin tarjeta de crédito requerida).

---

### 1. Overview & Core Concept

- **Qué hace**: Conecta una base de datos Firebase Firestore y autenticación Google en la nube mientras mantiene una capa de caché local (`localStorage`) en el navegador. Al iniciar sesión en tu PC o teléfono inteligente, tus operaciones se descargan y sincronizan automáticamente. Si no hay conexión o decides no iniciar sesión, la app sigue funcionando de manera 100% autónoma en modo local.
- **Público objetivo**: Trader personal de futuros que opera en PC de escritorio y consulta, registra o revisa su diario y psicología desde su celular.
- **Preservación de datos**: Antes de sincronizar cualquier dato, se verifica la integridad de los datos locales y nunca se elimina el historial existente.

---

### 2. User Experience & Visual Design

- **Flujo de Usuario y Sincronización**:
  1. **Barra Superior**:
     - Botón de `Iniciar Sesión con Google` discreto y adaptado a la estética oscura actual.
     - Al conectar, muestra tu avatar o iniciales y un indicador de estado: `Sincronizado en la Nube` con icono verde.
  2. **Detección y Migración de Operaciones Existentes**:
     - Al iniciar sesión por primera vez con datos locales existentes, se sincronizan con Firestore respetando cada ID único de trade. Si un trade ya existe en la nube con ese ID, se actualiza solo si es más reciente, evitando duplicados.
  3. **Continuidad de Respaldos**:
     - La pestaña de `Ajustes y Respaldo` sigue ofreciendo:
       - Exportar Respaldo JSON completo.
       - Restaurar Respaldo JSON con verificación previa.
       - Exportar historial a CSV con delimitador configurable (`;` para Excel).
  4. **Adaptabilidad Móvil**:
     - Se mantiene la interfaz táctil fluida para que registrar un trade o conversar con el Trading Coach sea rápido desde el smartphone.

---

### 3. Costos y Configuración Manual Explicados

- **¿Qué costos pueden aparecer?**
  - **Cero USD ($0.00)**. Firebase ofrece el **Plan Spark** que es 100% gratuito sin requerir tarjeta de crédito.
  - El límite gratuito diario incluye:
    - **50,000 lecturas diarias** de documentos.
    - **20,000 escrituras diarias** de documentos.
    - **1 GB de almacenamiento** total.
  - Para un diario de trading personal (incluso con decenas de operaciones diarias y uso intensivo del Coach), es humanamente imposible alcanzar estos límites.
- **¿Qué debes configurar manualmente?**
  - Cuando se inicie el asistente de configuración en AI Studio, la herramienta te presentará una ventana emergente de confirmación de términos de Firebase para crear tu base de datos Firestore. Solo debes hacer clic en **Aceptar**.
  - No tendrás que escribir código ni manipular claves API complejas.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Diagrama de Flujo y Sincronización Híbrida

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INTERFAZ DEL TRADER                             │
│                  (PC de Trading / Teléfono Móvil)                      │
│                                                                        │
│   ┌────────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│   │ Formulario 6 Scale │   │ Analytics & PnL │   │  Trading Coach  │   │
│   │     In Trades      │   │   Dashboard     │   │   Gemini Chat   │   │
│   └─────────┬──────────┘   └────────┬────────┘   └────────┬────────┘   │
│             │                       │                     │            │
│             └───────────────────────┼─────────────────────┘            │
│                                     ▼                                  │
│                     ┌───────────────────────────────┐                  │
│                     │       GESTOR DE ESTADO        │                  │
│                     │  Fórmulas / Cálculos PnL / R  │                  │
│                     └───────┬───────────────┬───────┘                  │
│                             │               │                          │
│         Modo Offline /      │               │  Usuario Autenticado     │
│         Caché Respaldo      ▼               ▼  (Google Auth)           │
│                    ┌────────────────┐   ┌──────────────────────────┐   │
│                    │  localStorage  │   │ Firestore Synchronization│   │
│                    │   (Siempre a   │   │  - onSnapshot en tiempo  │   │
│                    │     salvo)     │   │    real entre PC y móvil │   │
│                    └────────────────┘   └─────────────┬────────────┘   │
└───────────────────────────────────────────────────────┼────────────────┘
                                                        │ HTTPS / WSS
                                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FIREBASE FIRESTORE EN LA NUBE                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Colección: /users/{userId}/trades/{tradeId}                    │   │
│   │ - Documentos indexados por ID exacto de operación              │   │
│   │ - Reglas: allow read, write: if request.auth.uid == userId;    │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Modelo de Reglas de Seguridad en Firestore (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Denegación por defecto
    match /{document=**} {
      allow read, write: if false;
    }

    // Aislamiento estricto por usuario: solo el dueño de la cuenta puede acceder
    match /users/{userId}/trades/{tradeId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/settings/{settingId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/reports/{reportId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### Estrategia de Migración Libre de Duplicados

1. **Lectura de datos locales**: La aplicación lee las operaciones existentes en `localStorage`.
2. **Asignación de claves por ID**: Cada operación mantiene su ID único asignado (`TRD-20261008-001`).
3. **Escritura idempotente**: En Firestore se guarda directamente en `/users/{userId}/trades/{trade.id}` usando `setDoc(docRef, trade, { merge: true })`.
4. **Cero duplicados**: Si una operación ya existe en la nube con ese ID, no se creará una segunda; simplemente se preservará.
5. **No eliminación local**: El `localStorage` se mantiene intacto como red de seguridad y respaldo instantáneo en caso de operar sin conexión.
