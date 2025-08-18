import { Context } from './Context';

export abstract class IgnitorModule {
    abstract name: string;
    abstract initialize(context: Context): Promise<void>;
}
