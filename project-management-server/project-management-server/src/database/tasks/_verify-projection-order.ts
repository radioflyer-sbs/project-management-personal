import { computeProjectionOrder } from './projection-order.util';

const L = (x: number, y: number, w = 50, h = 50) => ({ x, y, width: w, height: h, zIndex: 1 });
const task = (id: string, x: number, y: number, w = 50, h = 50, urgency = 'normal') =>
    ({ _id: id, layout: L(x, y, w, h), urgency } as any);
const group = (layout: any, itemIds: string[]) => ({ layout, itemIds } as any);

let pass = true;
function check(name: string, got: string[], want: string[]) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    pass = pass && ok;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}

// 1. Vertical stack → top to bottom
check('vertical stack',
    computeProjectionOrder([task('a', 0, 0), task('b', 0, 60), task('c', 0, 120)], []),
    ['a', 'b', 'c']);

// 2. Horizontal row → left to right (input order scrambled)
check('horizontal row',
    computeProjectionOrder([task('c', 120, 0), task('a', 0, 0), task('b', 60, 0)], []),
    ['a', 'b', 'c']);

// 3. Different heights, same line: shorter card lower-topped but left → comes first
check('mixed heights same row',
    computeProjectionOrder([task('tall', 60, 0, 50, 50), task('short', 0, 10, 50, 30)], []),
    ['short', 'tall']);

// 4. Grid: two rows of two
check('2x2 grid',
    computeProjectionOrder([
        task('br', 60, 60), task('tl', 0, 0), task('tr', 60, 0), task('bl', 0, 60),
    ], []),
    ['tl', 'tr', 'bl', 'br']);

// 5. Group expands in place, in itemIds order; competes as a box on the left of a loose task
check('group left of loose task (same row)',
    computeProjectionOrder(
        [task('x', 200, 10), task('a', 0, 0), task('b', 0, 0)],
        [group(L(0, 0, 120, 80), ['a', 'b'])]),
    ['a', 'b', 'x']);

// 6. Group below a loose task: loose first, then group members in declared order
check('loose task above group',
    computeProjectionOrder(
        [task('top', 0, 0), task('a', 0, 200), task('b', 0, 200)],
        [group(L(0, 150, 120, 120), ['b', 'a'])]),  // itemIds order b,a is authoritative
    ['top', 'b', 'a']);

console.log(pass ? '\nALL PASS' : '\nSOME FAILED');
process.exit(pass ? 0 : 1);
