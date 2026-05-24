const ex = (id, name, sets, reps) => ({ id, name, sets, reps, weight: '' })

export const DEFAULT_ROUTINES = [
  {
    id: 'plan-lunes',
    name: 'Lunes · Espalda y Abdomen',
    tag: 'FUERZA',
    exercises: [
      ex('lun-1', 'Dominadas (Pronas o Neutras)', 4, 'Al fallo (-1 o -2)'),
      ex('lun-2', 'Remo con barra (peso fijo)', 4, '10 a 12'),
      ex('lun-3', 'Remo un brazo con mancuerna', 3, '12 por lado'),
      ex('lun-4', 'Pullover con banda elástica', 3, '15'),
      ex('lun-5', 'Elevación de piernas colgado', 4, '12 a 15'),
      ex('lun-6', 'Plancha abdominal estándar', 3, '45 seg'),
    ],
  },
  {
    id: 'plan-martes',
    name: 'Martes · Brazos (Hipertrofia)',
    tag: 'FUERZA',
    exercises: [
      ex('mar-1', 'Fondos en paralelas', 4, '8 a 10'),
      ex('mar-2', 'Curl de bíceps con barra', 4, '10'),
      ex('mar-3', 'Press Francés con mancuernas', 4, '12'),
      ex('mar-4', 'Curl de bíceps inclinado', 3, '12'),
      ex('mar-5', 'Extensión de tríceps con banda', 3, '15'),
      ex('mar-6', 'Curl martillo con mancuernas', 3, '12'),
    ],
  },
  {
    id: 'plan-miercoles',
    name: 'Miércoles · Piernas y Cardio',
    tag: 'CARDIO',
    exercises: [
      ex('mie-1', 'Sentadillas con mancuernas', 4, '12'),
      ex('mie-2', 'Peso muerto rumano con barra', 4, '10'),
      ex('mie-3', 'Zancadas estáticas', 3, '12 por lado'),
      ex('mie-4', 'Elevación de talones (pantorrillas)', 4, '20'),
      ex('mie-5', 'Bicicleta estática (LISS)', 1, '25-30 min'),
    ],
  },
  {
    id: 'plan-jueves',
    name: 'Jueves · Pecho, Hombros y Core',
    tag: 'FUERZA',
    exercises: [
      ex('jue-1', 'Press inclinado con mancuernas', 4, '10'),
      ex('jue-2', 'Press militar con mancuernas', 4, '10'),
      ex('jue-3', 'Elevaciones laterales con mancuernas', 4, '15'),
      ex('jue-4', 'Flexiones de pecho (Push-ups)', 3, 'Al fallo'),
      ex('jue-5', 'Crunch abdominal en banco', 4, '15-20'),
      ex('jue-6', 'Giros rusos (Russian Twists)', 3, '20 totales'),
    ],
  },
  {
    id: 'plan-viernes',
    name: 'Viernes · Brazos Superseries + HIIT',
    tag: 'FUERZA',
    exercises: [
      ex('vie-1', 'Superserie: Curl concentrado + Ext. tríceps tras nuca', 4, '12 / 12'),
      ex('vie-2', 'Superserie: Curl inverso + Fondos en banco', 3, '12 / 15'),
      ex('vie-3', 'Superserie: Curl con banda + Flexiones diamante', 3, '20 / Al fallo'),
      ex('vie-4', 'Bicicleta estática (HIIT)', 1, '20 min'),
    ],
  },
]

export function getDefaultRoutines() {
  return JSON.parse(JSON.stringify(DEFAULT_ROUTINES))
}
