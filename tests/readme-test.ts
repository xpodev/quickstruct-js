import { Int, Char, Struct, toBytes, fromBytes } from '../src';

@Struct()
class SimpleStruct {
  int1 = Int();
  char1 = Char();
  char2 = Char();
}

const simpleStruct = new SimpleStruct();
simpleStruct.int1 = 1234;
simpleStruct.char1 = 'a';
simpleStruct.char2 = 600;

const bytes = toBytes(simpleStruct);
console.log(bytes);
const simpleStruct2 = fromBytes(SimpleStruct, bytes);
console.log({...simpleStruct2});

console.log(simpleStruct2.int1 + 100);