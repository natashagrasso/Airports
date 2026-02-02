const fs = require('fs')
const path = require('path')

// Rutas actualizadas para data_transport.json
const rutaOriginal = path.join(__dirname, '..', 'data', 'data_transport.json')
const rutaLimpia = path.join(
  __dirname,
  '..',
  'data',
  'data_transport_clean.json',
)

try {
  if (!fs.existsSync(rutaOriginal)) {
    throw new Error(`No se encontró data_transport.json en: ${rutaOriginal}`)
  }

  const data = JSON.parse(fs.readFileSync(rutaOriginal, 'utf8'))

  const cleaned = data.filter(airport => {
    return airport.iata_faa !== null || airport.icao !== null
  })

  fs.writeFileSync(rutaLimpia, JSON.stringify(cleaned, null, 2))
  console.log(`✅ ¡Proceso terminado! Se creó: data_transport_clean.json`)
} catch (error) {
  console.error(`❌ Error: ${error.message}`)
}
