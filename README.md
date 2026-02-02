Aeropuertos (TP6)

Este proyecto es una aplicación Full-Stack diseñada para visualizar, gestionar y analizar datos aeroportuarios globales en tiempo real. Utiliza una arquitectura basada en microservicios orquestados con Docker, aprovechando la potencia de MongoDB para la persistencia de datos y Redis para operaciones de alto rendimiento (geoespaciales y rankings).

Tecnologías Utilizadas

Backend
Node.js & Express: Servidor API RESTful.

MongoDB (Mongoose): Base de datos principal para almacenar la información detallada de los aeropuertos.

Redis (Cliente redis):

Redis GEO: Almacenamiento de coordenadas para búsquedas espaciales ultrarrápidas.

Redis Sorted Sets: Gestión del ranking de popularidad en tiempo real.

FS & Path: Procesamiento y reparación automática de archivos de datos (JSON).

Frontend:
HTML5 & CSS3: Interfaz de usuario moderna con paneles translúcidos (Glassmorphism).

JavaScript (ES6+): Lógica del cliente, manejo del DOM y consumo de API (Fetch).

Leaflet.js: Librería de mapas interactivos.

Leaflet.markercluster: Agrupación visual de marcadores para mejorar el rendimiento del mapa.

Infraestructura

Docker: Contenerización de servicios.

Docker Compose: Orquestación de la red, volúmenes y servicios (Mongo, Redis Geo, Redis Pop, Backend, Frontend).

Ejecutar el comando de construcción y arranque:

docker compose up --build

Esperar a que la terminal muestre el mensaje: ✅ Carga completa y exitosa.

🖥️ Acceso a la Aplicación

Servicio

URL

Descripción

Frontend (Mapa)

http://localhost:8080

Interfaz visual interactiva

Backend (API)

http://localhost:3000/airports

Endpoints de datos crudos
