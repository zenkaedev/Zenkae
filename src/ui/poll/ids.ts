export const pollIds = {
create: 'poll:create',
createModal: 'poll:create:modal',
vote: (pollId: string, idx: number) => `poll:vote:${pollId}:${idx}`,
close: (pollId: string) => `poll:close:${pollId}`,
results: (pollId: string) => `poll:results:${pollId}`,
isVote: (cid: string) => cid.startsWith('poll:vote:'),
parseVote: (cid: string) => {
const [, , pollId, idx] = cid.split(':');
return { pollId, idx: Number(idx) };
},
};