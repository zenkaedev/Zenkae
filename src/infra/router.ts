import type {
    Interaction,
    ButtonInteraction,
    AnySelectMenuInteraction,
    ModalSubmitInteraction,
    CacheType
} from 'discord.js';


type Handler<T extends Interaction> = (interaction: T) => Promise<void>;

type Route<T extends Interaction> = {
    matcher: string | RegExp;
    handler: Handler<T>;
};

export class InteractionRouter {
    private buttons: Route<ButtonInteraction>[] = [];
    private modals: Route<ModalSubmitInteraction>[] = [];
    private selects: Route<AnySelectMenuInteraction>[] = [];

    /** Register a button handler */
    public button(matcher: string | RegExp, handler: Handler<ButtonInteraction>) {
        this.buttons.push({ matcher, handler });
    }

    /** Register a modal handler */
    public modal(matcher: string | RegExp, handler: Handler<ModalSubmitInteraction>) {
        this.modals.push({ matcher, handler });
    }

    /** Register a select (string/user/role/channel) handler */
    public select(matcher: string | RegExp, handler: Handler<AnySelectMenuInteraction>) {
        this.selects.push({ matcher, handler });
    }

    /** Merge another router into this one (for modularity) */
    public merge(other: InteractionRouter) {
        this.buttons.push(...other.buttons);
        this.modals.push(...other.modals);
        this.selects.push(...other.selects);
    }

    public async handle(interaction: Interaction<CacheType>): Promise<boolean> {
        if (interaction.isButton()) {
            return this.execute(this.buttons, interaction.customId, interaction);
        }
        if (interaction.isModalSubmit()) {
            return this.execute(this.modals, interaction.customId, interaction);
        }
        if (interaction.isAnySelectMenu()) {
            return this.execute(this.selects, interaction.customId, interaction);
        }
        return false;
    }

    private async execute<T extends Interaction>(
        routes: Route<T>[],
        customId: string,
        interaction: T
    ): Promise<boolean> {
        for (const route of routes) {
            const isMatch =
                typeof route.matcher === 'string'
                    ? route.matcher === customId
                    : route.matcher.test(customId);

            if (isMatch) {
                await route.handler(interaction);
                return true;
            }
        }
        return false;
    }
}
