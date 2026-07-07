const { BlockNoteSchema, defaultBlockSpecs } = require('@blocknote/core');
const schema = BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs } });
console.log(Object.keys(schema));
