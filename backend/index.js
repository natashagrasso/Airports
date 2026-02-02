const express = require('express')
const mongoose = require('mongoose')
const redis = require('redis')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

// cogifnuración de conexiones
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/airport_db'
const REDIS_GEO_URL = `redis://${process.env.REDIS_GEO_HOST || 'redis-geo'}:6379`
const REDIS_POP_URL = `redis://${process.env.REDIS_POP_HOST || 'redis-pop'}:6379`

const redisGeo = redis.createClient({ url: REDIS_GEO_URL })
const redisPop = redis.createClient({ url: REDIS_POP_URL })

redisGeo.on('error', err => console.log('❌ Error en Redis GEO:', err))
redisPop.on('error', err => console.log('❌ Error en Redis Popularidad:', err))

// Iniciamos .
async function connectServices() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Base de datos (Mongo) conectada')
    await redisGeo.connect()
    await redisPop.connect()
    console.log('✅ Memorias rápidas (Redis) conectadas')

    seedDatabase()
  } catch (error) {
    console.error('❌ Falló la conexión:', error)
  }
}
connectServices()

const Airport = mongoose.model(
  'Airport',
  new mongoose.Schema({
    name: String,
    city: String,
    iata_faa: String,
    icao: String,
    lat: Number,
    lng: Number,
    alt: Number,
    tz: String,
  }),
)

// CARGA INICIAL DE DATOS
//  leer JSON y guardar en Mongo + Redis

async function seedDatabase() {
  try {
    // Primero nos fijamos si ya tenemos datos para no duplicar.
    const mongoCount = await Airport.countDocuments()
    const redisCount = await redisGeo.zCard('airports-geo')

    if (mongoCount > 0 && redisCount > 0) {
      const popExists = await redisPop.exists('airport_popularity')
      if (!popExists)
        await redisPop.zAdd('airport_popularity', { score: 0, value: 'INIT' })
      return console.log('✅ El sistema ya tiene datos. Todo listo.')
    }

    // Si Redis se borro,pero Mongo no, recargamos redis
    if (mongoCount > 0 && redisCount === 0) {
      console.log(
        '⚠️ Restaurando memoria de mapas (Redis) desde la base de datos...',
      )
      const allAirports = await Airport.find()
      for (const ap of allAirports) {
        const code = ap.iata_faa || ap.icao
        if (ap.lat && ap.lng && code) {
          await redisGeo.geoAdd('airports-geo', {
            longitude: ap.lng,
            latitude: ap.lat,
            member: code,
          })
        }
      }
      await redisPop.zAdd('airport_popularity', { score: 0, value: 'INIT' })
      return console.log('♻️ Restauración completada.')
    }

    console.log('🚀 Iniciando carga desde cero con el archivo JSON...')

    // Buscamos el archivo de datos.
    let dataPath = path.join(__dirname, 'data', 'data_transport.json')
    if (!fs.existsSync(dataPath))
      dataPath = path.join(__dirname, 'data', 'data_trasport.json')

    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8').trim()
      let airports = []

      // corrijo el json
      try {
        airports = JSON.parse(rawData)
      } catch (e) {
        console.log(
          '⚠️ El archivo tiene errores. Reparando formato automáticamente...',
        )
        const fixed = `[${rawData.replace(/}\s*{/g, '},{')}]`
        try {
          airports = JSON.parse(fixed)
        } catch (e2) {}
      }

      const validos = airports.filter(
        a =>
          (a.iata_faa && a.iata_faa !== 'Null') ||
          (a.icao && a.icao !== 'Null'),
      )

      for (const ap of validos) {
        const code =
          ap.iata_faa && ap.iata_faa !== 'Null' ? ap.iata_faa : ap.icao

        //  Guardamos en  la bd,mongo
        await Airport.create({
          name: ap.name,
          city: ap.city || ap.name,
          iata_faa: code,
          icao: ap.icao,
          lat: parseFloat(ap.lat),
          lng: parseFloat(ap.lng),
          alt: parseFloat(ap.alt),
          tz: ap.tz,
        })

        // guardo en el mapaa redis-geo
        if (ap.lat && ap.lng) {
          await redisGeo.geoAdd('airports-geo', {
            longitude: parseFloat(ap.lng),
            latitude: parseFloat(ap.lat),
            member: code,
          })
        }
      }
      console.log(`✅ Se cargaron ${validos.length} aeropuertos correctamente.`)
      await redisPop.zAdd('airport_popularity', { score: 0, value: 'INIT' })
    } else {
      console.log('❌ No encontré el archivo de datos.')
    }
  } catch (err) {
    console.error('❌ Error en la carga:', err)
  }
}

// --- RUTAS DEL SISTEMA ---

// devuelve la lista de todos los aeropuertos
app.get('/airports', async (req, res) => {
  res.json(await Airport.find().limit(500))
})

//  POPULARIDAD
app.get('/airports/popular', async (req, res) => {
  try {
    // los mejores 10 al ranking
    const result = await redisPop.zRangeWithScores('airport_popularity', 0, 9, {
      REV: true,
    })
    const validos = result.filter(r => r.value !== 'INIT')
    res.json({ results: validos.map(i => ({ code: i.value, score: i.score })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// CONSULTAS GEOESPACIALES
// Busca aeropuertos cercanos usando funciones de Redis.
app.get('/airports/nearby', async (req, res) => {
  const { lat, lng, radius } = req.query
  if (!lat) return res.status(400).json({ error: 'Faltan datos' })

  try {
    // aeropuertos están en ese radio (
    const results = await redisGeo.geoSearch(
      'airports-geo',
      { longitude: parseFloat(lng), latitude: parseFloat(lat) },
      { radius: parseFloat(radius), unit: 'km' },
    )

    if (results.length > 0) {
      const airports = await Airport.find({
        $or: [{ iata_faa: { $in: results } }, { icao: { $in: results } }],
      })
      res.json({ results: airports })
    } else {
      res.json({ results: [] })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

//DETALLE Y CONTADOR DE VISITA
app.get('/airports/:code', async (req, res) => {
  const code = req.params.code.toUpperCase()
  console.log(`👉 Solicitud de aeropuerto: ${code}`)

  try {
    const ap = await Airport.findOne({
      $or: [{ iata_faa: code }, { icao: code }],
    })
    if (ap) {
      await redisPop.zIncrBy('airport_popularity', 1, code)

      await redisPop.expire('airport_popularity', 86400)

      res.json(ap)
    } else {
      res.status(404).json({ error: 'No encontrado' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

//(CRUD)

// CREAR
app.post('/airports', async (req, res) => {
  try {
    const ap = await Airport.create(req.body)
    const code = ap.iata_faa || ap.icao

    if (ap.lat && ap.lng) {
      await redisGeo.geoAdd('airports-geo', {
        longitude: parseFloat(ap.lng),
        latitude: parseFloat(ap.lat),
        member: code,
      })
    }
    res.status(201).json(ap)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// MODIFICAR
app.put('/airports/:code', async (req, res) => {
  const code = req.params.code.toUpperCase()
  try {
    const updated = await Airport.findOneAndUpdate(
      { $or: [{ iata_faa: code }, { icao: code }] },
      req.body,
      { new: true },
    )
    if (updated) res.json(updated)
    else res.status(404).json({ error: 'No encontrado' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ELIMINAR
app.delete('/airports/:code', async (req, res) => {
  const code = req.params.code.toUpperCase()
  try {
    const deleted = await Airport.findOneAndDelete({
      $or: [{ iata_faa: code }, { icao: code }],
    })

    if (deleted) {
      await redisGeo.zRem('airports-geo', code) // Borrar del mapa
      await redisPop.zRem('airport_popularity', code) // Borrar del ranking
      res.json({ message: 'Eliminado correctamente' })
    } else {
      res.status(404).json({ error: 'No encontrado' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(3000, () => console.log('🔥 Servidor listo en puerto 3000'))
