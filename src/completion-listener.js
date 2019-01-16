const Rx = require('rxjs');
const { bufferCount, map, switchMap, take, mergeMap } = require('rxjs/operators');
const { defer, from } = require('rxjs');

module.exports = class CompletionListener {
    constructor({ successCondition, scheduler, maxConcurrent }) {
        this.successCondition = successCondition;
        this.scheduler = scheduler;
        this.maxConcurrent = maxConcurrent;
    }

    startAndListen(commands) {
        const concurrentCommands = commands.map(c => defer(() => {
            c.start();
            return c.close.pipe(take(1));
        }));
        
        from(concurrentCommands).pipe(
            mergeMap(c=>c, this.maxConcurrent),
            bufferCount(concurrentCommands.length),
            map(exitCodes => {
                switch (this.successCondition) {
                /* eslint-disable indent */
                    case 'first':
                        return exitCodes[0] === 0;

                    case 'last':
                        return exitCodes[exitCodes.length - 1] === 0;

                    default:
                        return exitCodes.every(exitCode => exitCode === 0);
                /* eslint-enable indent */
                }
            }),
            switchMap(success => success
                ? Rx.of(null, this.scheduler)
                : Rx.throwError(new Error(), this.scheduler)),
            take(1)
        ).toPromise();
    }
};
