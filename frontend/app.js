const API_URL = 'http://localhost:3000'

//CONFIG MAPA
const map = L.map('map').setView([20, 0], 2)

// visual del mapa
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map)

//  agrupar marcadores (Clustering)
const markers = L.markerClusterGroup()
let geoCircle = null //circulo de búsqueda

const planeIcon = L.divIcon({
  html: '<i class="fas fa-plane" style="color: #2980b9; font-size: 24px; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.3));"></i>',
  className: 'custom-plane-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10],
})

// CARGAR TODOS LOS AEROPUERTOS (LEER)
async function cargarAeropuertos() {
  try {
    const infoDiv = document.getElementById('info')
    if (infoDiv)
      infoDiv.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Cargando datos...'

    const res = await fetch(`${API_URL}/airports`)
    const airports = await res.json()

    markers.clearLayers()

    airports.forEach(ap => {
      if (ap.lat && ap.lng) {
        const marker = L.marker([ap.lat, ap.lng], { icon: planeIcon })

        // Codigo principal (IATA o ICAO)
        const code =
          ap.iata_faa && ap.iata_faa !== 'Null' ? ap.iata_faa : ap.icao

        // Globo de informacion con botones
        const popupHTML = `
                    <div style="text-align:center; font-family:sans-serif; min-width:150px;">
                        <h3 style="margin:0; color:#2980b9">${code}</h3>
                        <b>${ap.name}</b><br>
                        <small>${ap.city || ''}</small><br>
                        <hr style="margin: 5px 0; border:0; border-top:1px solid #ccc;">
                        
                        <!-- Botones de Acción -->
                        <div style="display:flex; justify-content:space-around; margin-top:5px;">
                            <button onclick="prepararEdicion('${code}', '${ap.name}', ${ap.lat}, ${ap.lng})" 
                                    style="background:#f39c12; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button onclick="eliminarAeropuerto('${code}')" 
                                    style="background:#c0392b; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:4px; font-size:11px;">
                                <i class="fas fa-trash"></i> Borrar
                            </button>
                        </div>
                        <div style="margin-top:5px; font-size:10px; color:green;">
                           <i class="fas fa-eye"></i> Visita sumada al hacer clic
                        </div>
                    </div>
                `

        marker.bindPopup(popupHTML)

        // cuando hacemos clic en el avion suma popularisad
        marker.on('click', () => {
          console.log(`Click en ${code}, sumando visita...`)
          fetch(`${API_URL}/airports/${code}`).then(() => actualizarRanking()) // Actualizamos el ranking
        })

        markers.addLayer(marker)
      }
    })

    map.addLayer(markers)

    if (infoDiv)
      infoDiv.innerHTML = `✅ <b>${airports.length}</b> Aeropuertos activos`
    actualizarRanking()
  } catch (error) {
    console.error('Error cargando mapa:', error)
    const infoDiv = document.getElementById('info')
    if (infoDiv)
      infoDiv.innerHTML = '<span style="color:red">Error de conexión</span>'
  }
}

// CREAR O ACTUALIZAR
window.guardarAeropuerto = async metodo => {
  const name = document.getElementById('name').value
  const code = document.getElementById('code').value.toUpperCase()
  const lat = document.getElementById('lat').value
  const lng = document.getElementById('lng').value

  const codigoDestino =
    metodo === 'PUT' ? document.getElementById('edit-code').value : code

  if (!name || !code || !lat || !lng) {
    return alert('Por favor, completa todos los campos.')
  }

  const body = {
    name: name,
    city: name,
    iata_faa: code.length === 3 ? code : null,
    icao: code.length === 4 ? code : null,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
  }

  try {
    const url =
      metodo === 'POST'
        ? `${API_URL}/airports`
        : `${API_URL}/airports/${codigoDestino}`

    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      alert(
        metodo === 'POST'
          ? '✅ Aeropuerto Creado'
          : '✅ Aeropuerto Actualizado',
      )
      window.cancelarEdicion()
      cargarAeropuertos()
    } else {
      alert('❌ Error al guardar. Verifica los datos.')
    }
  } catch (e) {
    console.error(e)
    alert('❌ Error de conexión con el backend.')
  }
}

// ELIMINAR
window.eliminarAeropuerto = async code => {
  if (!confirm(`¿Estás seguro de ELIMINAR el aeropuerto ${code}?`)) return

  try {
    const res = await fetch(`${API_URL}/airports/${code}`, { method: 'DELETE' })
    if (res.ok) {
      alert('🗑️ Aeropuerto eliminado.')
      cargarAeropuertos() // Refrescar
    } else {
      alert('Error al eliminar (puede que no exista).')
    }
  } catch (e) {
    console.error(e)
    alert('Error de conexión.')
  }
}

//  BUSCADOR
window.buscarAeropuerto = async () => {
  const input = document.getElementById('search-input').value.toUpperCase()
  if (!input) return

  try {
    const res = await fetch(`${API_URL}/airports/${input}`)
    if (res.ok) {
      const data = await res.json()
      const ap = Array.isArray(data) ? data[0] : data

      if (ap && ap.lat && ap.lng) {
        map.flyTo([ap.lat, ap.lng], 12)

        // Intentar abrir el popup (buscando en los marcadores)
        let encontrado = false
        markers.eachLayer(layer => {
          const latLng = layer.getLatLng()
          // Comparamos coordenadas aproximadas para encontrar el marcador
          if (
            Math.abs(latLng.lat - ap.lat) < 0.0001 &&
            Math.abs(latLng.lng - ap.lng) < 0.0001
          ) {
            layer.openPopup()
            encontrado = true
          }
        })

        if (!encontrado) {
          console.log('Aeropuerto encontrado pero marcador oculto por cluster')
        }

        actualizarRanking() // La busqueda cuenta como visita
      } else {
        alert('Datos de aeropuerto incompletos')
      }
    } else {
      alert('Aeropuerto no encontrado')
    }
  } catch (e) {
    console.error(e)
  }
}

// RANKING DE POPULARIDAD
async function actualizarRanking() {
  try {
    const res = await fetch(`${API_URL}/airports/popular`)
    const data = await res.json()
    const div = document.getElementById('ranking-list')

    if (data.results && data.results.length > 0) {
      div.innerHTML = data.results
        .map(
          (r, i) => `
                    <div class="rank-item" style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:4px 0;">
                        <span>#${i + 1} <b>${r.code}</b></span>
                        <span class="rank-score" style="background:#e67e22; color:white; padding:1px 6px; border-radius:10px; font-size:0.85em;">${r.score}</span>
                    </div>
                `,
        )
        .join('')
    } else {
      div.innerHTML =
        '<div style="padding:10px; color:#777; text-align:center">Sin datos aún.<br>Haz clic en los aviones.</div>'
    }
  } catch (e) {
    console.error('Error ranking', e)
  }
}

//  FORMULARIO
window.prepararEdicion = (code, name, lat, lng) => {
  document.getElementById('edit-code').value = code
  document.getElementById('code').value = code
  document.getElementById('name').value = name
  document.getElementById('lat').value = lat
  document.getElementById('lng').value = lng

  document.getElementById('btn-create').style.display = 'none'
  document.getElementById('btn-update').style.display = 'block'
  document.getElementById('btn-cancel').style.display = 'block'
}

// Limpiar formulario
window.cancelarEdicion = () => {
  document.getElementById('name').value = ''
  document.getElementById('code').value = ''
  document.getElementById('lat').value = ''
  document.getElementById('lng').value = ''
  document.getElementById('edit-code').value = ''

  // Volver a modo creación
  document.getElementById('btn-create').style.display = 'block'
  document.getElementById('btn-update').style.display = 'none'
  document.getElementById('btn-cancel').style.display = 'none'
}

// CLIC DERECHO , busqueda geoespacial
map.on('contextmenu', async e => {
  const { lat, lng } = e.latlng

  //  circulo visual rojo (500km)
  if (geoCircle) map.removeLayer(geoCircle)
  geoCircle = L.circle([lat, lng], {
    radius: 500000,
    color: '#e74c3c',
    fillOpacity: 0.1,
  }).addTo(map)

  // Consultar API
  try {
    const res = await fetch(
      `${API_URL}/airports/nearby?lat=${lat}&lng=${lng}&radius=500`,
    )
    const data = await res.json()

    const lista =
      data.results && data.results.length > 0
        ? data.results.map(a => a.iata_faa || a.icao).join(', ')
        : 'Ninguno encontrado'

    L.popup()
      .setLatLng(e.latlng)
      .setContent(
        `
                <div style="text-align:center">
                    <b>📍 Búsqueda por Radio (500km)</b><br>
                    Centro: ${lat.toFixed(2)}, ${lng.toFixed(2)}<br>
                    <hr style="margin:5px 0">
                    ${lista}
                </div>
            `,
      )
      .openOn(map)
  } catch (e) {
    console.error('Error nearby:', e)
  }
})

cargarAeropuertos()
