const express = require('express')
const path = require('path')
const app = express()
const PORT = 80

app.use(express.static(__dirname))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.listen(PORT, () => {
  console.log(
    `🌐 Frontend listo en http://localhost:8080 (mapeado al puerto ${PORT} del contenedor)`,
  )
})
