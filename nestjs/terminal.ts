import { program } from 'commander';

const entity_command = program.command('entity');
entity_command.command('create').action(() => {
  console.log('create');
});
entity_command.command('modify').action(() => {
  console.log('modify');
});

program.parse();
