# Novedades retroactivas

Convención para registrar en la app una gestión que se hizo **por fuera** de ella.

## El problema

El tablero arma cada ficha a partir de lo que la persona **declaró**: las opciones de
la encuesta inicial y los "Requerimientos Adicionales" de sus novedades. Una gestión
que no nace de una declaración no tiene forma de aparecer, por mucho que se registre
su estado.

Es lo que pasó con medicamentos: Farmacia atendió a 51 colaboradores y lo documentó en
un archivo aparte (`SEGUIMIENTO MEDICAMENTOS.xlsx`). Ninguno había pedido medicamentos
en la app, así que el tablero mostraba ese trabajo como inexistente.

## La solución

Registrar una novedad **a nombre de la persona**, con el requerimiento que corresponda
y un texto que deja constancia de que ella no la reportó.

```
Requerimientos Adicionales : Medicamentos
Novedad / Situación        : No reportado por el colaborador. Esta gestión se realizó
                             de manera manual y se ingresa como novedad para ajustar
                             los datos de la gestión
```

Y en `GESTION_SST`, columna J, el estado atribuido a su disciplina:

```
[MEDICAMENTOS:RESUELTO] Entrega registrada en el archivo independiente de SEGUIMIENTO MEDICAMENTOS
```

Si la fila ya tiene notas, **se anexa** con ` || `, nunca se sobrescribe.

## La marca

La app reconoce estas novedades por una frase del texto:

```js
// app.js
const MARCA_NOVEDAD_RETROACTIVA = 'se ingresa como novedad para ajustar los datos';
```

**Si vas a registrar una novedad retroactiva a mano, el texto tiene que contener esa
frase.** La comparación ignora mayúsculas y tildes, pero las palabras deben estar.

## Qué hace y qué no hace la marca

| | |
|---|---|
| Entra al universo del tablero | **sí** |
| Aparece en la ficha de su disciplina | **sí** |
| Se ve en la fila del Centro de Gestión | **sí**, con su texto completo |
| Cuenta en la tarjeta "Alertas de Novedad" | **no** |
| Aparece en el filtro "Casos con Nuevas Novedades" | **no** |

La distinción es deliberada: esa tarjeta dice *"Colaboradores que registraron una nueva
situación o afectación crítica sobre su reporte inicial"*, y aquí nadie registró nada.
Contarlas ahí haría parecer que 51 personas reportaron algo el mismo día.

Si la persona además tiene una novedad **real**, sigue contando como alerta por esa.

## Dónde está en el código

```
app.js   MARCA_NOVEDAD_RETROACTIVA    la frase
         esNovedadRetroactiva(nov)    reconoce una novedad
         tieneNovedadReportada(r)     true si la persona reportó algo de verdad
                                      (lo usan el contador de la tarjeta y el filtro)
```

`getApoyoText` y `getNoveltyNeeds` **sí** las toman en cuenta, a propósito: es lo que
hace que la persona entre a su ficha. No las excluyas de ahí o la carga deja de servir.

## Antes de usarla

Registrar una novedad a nombre de alguien deja constancia de algo que esa persona no
hizo. Es aceptable para incorporar una gestión real que ya ocurrió, y por eso el texto
lo dice de forma explícita. **No la uses para inferir necesidades**: si alguien no pidió
algo y nadie lo atendió, no hay nada que registrar.

## Antecedente

Se usó por primera vez el 2026-09-09 con los 51 colaboradores de
`SEGUIMIENTO MEDICAMENTOS.xlsx` que tenían todos sus medicamentos entregados y no
figuraban en la ficha. Los que tenían entrega parcial o nada entregado quedaron fuera
por decisión del equipo.
