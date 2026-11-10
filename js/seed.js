// Групи м'язів у порядку показу на екрані «Вправи»
export const MUSCLE_GROUPS = ['Груди', 'Спина', 'Ноги', 'Плечі', 'Руки', 'Прес'];

// Стартовий список вправ: додається один раз, при першому запуску
export const STARTER_EXERCISES = [
  { name: 'Жим лежачи', muscleGroup: 'Груди' },
  { name: 'Жим гантелей лежачи', muscleGroup: 'Груди' },
  { name: 'Жим на похилій лаві', muscleGroup: 'Груди' },
  { name: 'Віджимання на брусах', muscleGroup: 'Груди' },
  { name: 'Розведення гантелей', muscleGroup: 'Груди' },

  { name: 'Станова тяга', muscleGroup: 'Спина' },
  { name: 'Підтягування', muscleGroup: 'Спина' },
  { name: 'Тяга штанги в нахилі', muscleGroup: 'Спина' },
  { name: 'Тяга верхнього блока', muscleGroup: 'Спина' },
  { name: 'Тяга гантелі однією рукою', muscleGroup: 'Спина' },
  { name: 'Тяга горизонтального блока', muscleGroup: 'Спина' },

  { name: 'Присід зі штангою', muscleGroup: 'Ноги' },
  { name: 'Жим ногами', muscleGroup: 'Ноги' },
  { name: 'Румунська тяга', muscleGroup: 'Ноги' },
  { name: 'Випади', muscleGroup: 'Ноги' },
  { name: 'Розгинання ніг', muscleGroup: 'Ноги' },
  { name: 'Згинання ніг', muscleGroup: 'Ноги' },
  { name: 'Підйом на носки', muscleGroup: 'Ноги' },

  { name: 'Жим штанги стоячи', muscleGroup: 'Плечі' },
  { name: 'Жим гантелей сидячи', muscleGroup: 'Плечі' },
  { name: 'Махи гантелями в сторони', muscleGroup: 'Плечі' },
  { name: 'Тяга штанги до підборіддя', muscleGroup: 'Плечі' },

  { name: 'Підйом штанги на біцепс', muscleGroup: 'Руки' },
  { name: 'Молоткові згинання', muscleGroup: 'Руки' },
  { name: 'Французький жим', muscleGroup: 'Руки' },
  { name: 'Розгинання на блоці (трицепс)', muscleGroup: 'Руки' },

  { name: 'Скручування', muscleGroup: 'Прес' },
  { name: 'Підйом ніг у висі', muscleGroup: 'Прес' },
  { name: 'Планка', muscleGroup: 'Прес' },
];
