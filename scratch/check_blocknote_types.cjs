const blocknote = require('@blocknote/core');
console.log(Object.keys(blocknote));
if (blocknote.BlockNoteSchema) {
  const schema = blocknote.BlockNoteSchema.create();
  console.log(Object.keys(schema));
}
