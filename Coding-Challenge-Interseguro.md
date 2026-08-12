# Coding Challenge - Interseguro

## Desafío técnico - Descripción

### Consideraciones técnicas

- Utilizar el lenguaje de programación **Go (Golang)** para una API y **Node.js** para la otra API.
- Implementar la solución utilizando los siguientes frameworks:
  - **Fiber** para la API en Go.
  - **Express.js** para la API en Node.js.
- Documentar el código de manera clara y concisa, siguiendo las mejores prácticas de codificación.
- Utilizar **Docker** para contenerizar las aplicaciones y facilitar su despliegue en diferentes entornos.
- Implementar la comunicación entre las dos API mediante un mecanismo como **HTTP**.
  - Utilizar servicios en la nube para la implementación y el despliegue de las aplicaciones.

### Arquitectura de la solución

#### API en Go

Esta API recibirá la matriz original como entrada, realizará la rotación de la matriz y luego enviará los datos resultantes a la segunda API en Node.js.

#### API en Node.js

Esta API recibirá los datos de la matriz rotada desde la API en Go, calculará estadísticas sobre los datos y devolverá dichas estadísticas como resultado.

## Funcionalidad requerida

Crear dos API RESTful:

1. **API en Go:** recibirá como entrada un array de arrays de números que represente una matriz rectangular y devolverá la **factorización QR** de dicha matriz.
2. **API en Node.js:** recibirá las matrices devueltas por la primera API y realizará una operación adicional sobre los datos, detallada en la sección [Operación adicional](#operación-adicional).

También se debe implementar de manera eficiente y correcta, en cada API, la lógica necesaria para realizar la rotación de la matriz y la operación adicional.

## Operación adicional

La segunda API calculará los siguientes valores sobre los datos de las matrices devueltas:

- **Valor máximo:** el valor máximo encontrado en las matrices.
- **Valor mínimo:** el valor mínimo encontrado en las matrices.
- **Promedio:** el promedio de todos los valores de las matrices.
- **Suma total:** la suma total de todos los valores de las matrices.
- **Matriz diagonal:** verificar si alguna matriz es diagonal.

## Funcionalidad opcional

- Implementar un frontend que consuma ambas API y muestre los resultados de la rotación de la matriz y las estadísticas adicionales.
- Aplicar un nivel de seguridad mediante **JWT** para proteger las consultas a las API.
- Implementar pruebas unitarias y de integración para garantizar la calidad del código en ambas API.

## Consideraciones de evaluación

- No existe un estándar específico para los nombres de los objetos creados, pero se espera coherencia en su estructura y documentación.
- En caso de dudas en el enunciado, se espera que el candidato tome decisiones informadas y las sustente durante la entrevista.
- Se valorarán:
  - La eficiencia de la solución.
  - La elegancia de la implementación.
  - La capacidad del candidato para comunicar y defender sus decisiones técnicas.

## Observación sobre una ambigüedad del documento

El PDF no es completamente consistente respecto de la operación que debe ejecutar la API en Go:

- En las secciones **Arquitectura de la solución**, **Funcionalidad requerida** y **Funcionalidad opcional** se menciona varias veces la **rotación de la matriz**.
- En la descripción específica de la API RESTful en Go se solicita devolver la **factorización QR** de la matriz.

Como ambas operaciones son matemáticamente distintas, conviene confirmar con Interseguro cuál es el requisito principal. Si no fuera posible aclararlo antes de desarrollar la solución, se recomienda documentar la interpretación elegida y justificarla durante la entrevista, tal como sugiere el propio enunciado.

---

*Contenido extraído y estructurado a partir del documento “Coding-Challenge Interseguro.pdf”.*
