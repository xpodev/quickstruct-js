import { Int, Char, Struct, toBytes, fromBytes } from '../src';

@Struct()
class SimpleStruct {
  int1 = Int();
  int2 = Int();
  char1 = Char();
  char2 = Char();
  char3 = Char();
}

const simpleStruct = new SimpleStruct();
simpleStruct.int1 = 1234;
simpleStruct.int2 = 5678;
simpleStruct.char1 = 250;
simpleStruct.char2 = 600;
simpleStruct.char3 = 'a';

const bytes = toBytes(simpleStruct);
console.log(bytes);
const simpleStruct2 = fromBytes(SimpleStruct, bytes);
console.log(simpleStruct2);

console.log(simpleStruct2.int1 + 100);
debugger;