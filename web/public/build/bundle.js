
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function get_binding_group_value(group, __value, checked) {
        const value = new Set();
        for (let i = 0; i < group.length; i += 1) {
            if (group[i].checked)
                value.add(group[i].__value);
        }
        if (!checked) {
            value.delete(__value);
        }
        return Array.from(value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var abilities = [
    	{
    		id: "ability_1057",
    		name: "Spore Bomb 7",
    		internalName: "SporeBomb7",
    		skill: "Mycology"
    	},
    	{
    		id: "ability_1071",
    		name: "Lycanspore Bomb",
    		internalName: "LycansporeBomb1",
    		skill: "Mycology"
    	},
    	{
    		id: "ability_1082",
    		name: "Mushroom Turret 7",
    		internalName: "MushroomTurret7",
    		skill: "Mycology"
    	},
    	{
    		id: "ability_1092",
    		name: "Kick Power -10",
    		internalName: "GolfAbility1",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1093",
    		name: "Kick Power +10",
    		internalName: "GolfAbility2",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1094",
    		name: "Kick Power Reset",
    		internalName: "GolfAbility3",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1095",
    		name: "English: Right +10",
    		internalName: "GolfAbility4",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1096",
    		name: "English: Left +10",
    		internalName: "GolfAbility5",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1097",
    		name: "English: Reset",
    		internalName: "GolfAbility6",
    		skill: "Sword"
    	},
    	{
    		id: "ability_1216",
    		name: "Tell Me About Your Mother 4",
    		internalName: "TellMeAboutYourMother4",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1234",
    		name: "But I Love You 3",
    		internalName: "ButILoveYou3",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1255",
    		name: "Summon Deer 5",
    		internalName: "SummonDeer5",
    		skill: "Deer"
    	},
    	{
    		id: "ability_1263",
    		name: "Fast Talk 4",
    		internalName: "FastTalk4",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1269",
    		name: "Psychoanalyze 6",
    		internalName: "Psychoanalyze6",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1270",
    		name: "Strike a Nerve 6",
    		internalName: "StrikeANerve6",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1271",
    		name: "Cause Terror 4",
    		internalName: "CauseTerror4",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1272",
    		name: "Pep Talk 6",
    		internalName: "PepTalk6",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1273",
    		name: "Ridicule 5",
    		internalName: "Ridicule5",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1274",
    		name: "Soothe 6",
    		internalName: "Soothe6",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1275",
    		name: "Positive Attitude 5",
    		internalName: "PositiveAttitude5",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1276",
    		name: "Inspire Confidence 4",
    		internalName: "InspireConfidence4",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1277",
    		name: "Mock 9",
    		internalName: "Mock9",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1278",
    		name: "You Were Adopted 6",
    		internalName: "YouWereAdopted6",
    		skill: "Psychology"
    	},
    	{
    		id: "ability_1305",
    		name: "Fish Gut 5",
    		internalName: "FishGut5",
    		skill: "Fishing"
    	},
    	{
    		id: "ability_1352",
    		name: "Shadow Feint 3",
    		internalName: "ShadowFeint3",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_1391",
    		name: "Pouncing Rend 3+",
    		internalName: "WerewolfPounce3BB",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_1394",
    		name: "Hunting Speed 3",
    		internalName: "WerewolfRun3",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_1423",
    		name: "Treat Disease 3",
    		internalName: "TreatDisease3",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_1432",
    		name: "Resuscitate 2",
    		internalName: "Resuscitate2",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_1443",
    		name: "Moss Bone Repair",
    		internalName: "MossBoneRepair",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_1444",
    		name: "Field Surgery 3",
    		internalName: "FieldSurgery3",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_1459",
    		name: "Patch Armor 9",
    		internalName: "ArmorPatching9",
    		skill: "ArmorPatching"
    	},
    	{
    		id: "ability_1462",
    		name: "Yetiskin 2",
    		internalName: "Yetiskin2",
    		skill: "ArmorPatching"
    	},
    	{
    		id: "ability_1511",
    		name: "Truffle Sniff 5",
    		internalName: "TruffleSniff5",
    		skill: "Pig"
    	},
    	{
    		id: "ability_1513",
    		name: "Terror Dash 2",
    		internalName: "PigDash2",
    		skill: "Pig"
    	},
    	{
    		id: "ability_1550",
    		name: "Harmlessness",
    		internalName: "Harmlessness",
    		skill: "Pig"
    	},
    	{
    		id: "ability_1592",
    		name: "Deer Kick 8",
    		internalName: "DeerKick8",
    		skill: "Deer"
    	},
    	{
    		id: "ability_1598",
    		name: "King of the Forest 5",
    		internalName: "KingOfTheForest5",
    		skill: "Deer"
    	},
    	{
    		id: "ability_1599",
    		name: "Cuteness Overload 5",
    		internalName: "DeerBlast5",
    		skill: "Deer"
    	},
    	{
    		id: "ability_1676",
    		name: "Graze",
    		internalName: "Graze1",
    		skill: "Cow"
    	},
    	{
    		id: "ability_1696",
    		name: "Collect Milk 3",
    		internalName: "CollectMilk3",
    		skill: "Cow"
    	},
    	{
    		id: "ability_1764",
    		name: "Trigger Golem",
    		internalName: "TriggerGolem",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1773",
    		name: "Healing Mist 8",
    		internalName: "HealingMist8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1775",
    		name: "Freezing Mist 8",
    		internalName: "FreezingMist8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1779",
    		name: "Mutation: Extra Toes 4",
    		internalName: "MutationSprint4",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1783",
    		name: "Create Armored Standard Golem",
    		internalName: "SummonMinigolem4A",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1797",
    		name: "Create Basic Golem",
    		internalName: "SummonMinigolem8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1809",
    		name: "Toxin Bomb 9",
    		internalName: "ToxinBomb9",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1810",
    		name: "Mycotoxin Formula 9",
    		internalName: "ToxinBomb9B",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1811",
    		name: "Acid Bomb 9",
    		internalName: "ToxinBomb9C",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1812",
    		name: "Haste Concoction 5",
    		internalName: "HasteConcoction5",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1813",
    		name: "Mutation: Knee Spikes 8",
    		internalName: "MutationKick8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1814",
    		name: "Mutation: Extra Skin 8",
    		internalName: "MutationMitigation8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1815",
    		name: "Mutation: Extra Heart 8",
    		internalName: "MutationPowerRegen8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1816",
    		name: "Mutation: Stretchy Spine 5",
    		internalName: "MutationTrauma5",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1817",
    		name: "Healing Injection 9",
    		internalName: "HealingInjection9",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1818",
    		name: "Toxic Irritant 8",
    		internalName: "ToxicIrritant8",
    		skill: "BattleChemistry"
    	},
    	{
    		id: "ability_1901",
    		name: "Seek Objective",
    		internalName: "SeekObjective",
    		skill: "Foraging"
    	},
    	{
    		id: "ability_1902",
    		name: "Objective Orienteering",
    		internalName: "ObjectiveOrienteering",
    		skill: "Foraging"
    	},
    	{
    		id: "ability_1955",
    		name: "Poison Blade 5",
    		internalName: "PoisonBlade5",
    		skill: "Alchemy"
    	},
    	{
    		id: "ability_1958",
    		name: "Wolfsbane Blade 3",
    		internalName: "WolfsbaneBlade3",
    		skill: "Alchemy"
    	},
    	{
    		id: "ability_2015",
    		name: "Call Stabled Pet #6",
    		internalName: "StabledPet6",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2020",
    		name: "Call Living Stabled Pet",
    		internalName: "StabledPetLiving",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2021",
    		name: "Tame Rat",
    		internalName: "TameRat",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2022",
    		name: "Tame Big Cat",
    		internalName: "TameCat",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2023",
    		name: "Tame Bear",
    		internalName: "TameBear",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2024",
    		name: "Tame Bee",
    		internalName: "TameBee",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2038",
    		name: "Sic 'Em 8",
    		internalName: "SicEm8",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2048",
    		name: "Get It Off Me 8",
    		internalName: "GetItOffMe8",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2058",
    		name: "Monstrous Rage 8",
    		internalName: "MonstrousRage8",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2068",
    		name: "Feed Pet 8",
    		internalName: "FeedPet8",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2079",
    		name: "That'll Do 9",
    		internalName: "ThatllDo9",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2086",
    		name: "Wild Endurance 6",
    		internalName: "WildEndurance6",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2096",
    		name: "Nimble Limbs 6",
    		internalName: "NimbleLimbs6",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_2105",
    		name: "Smash 6",
    		internalName: "StaffSmash6",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2115",
    		name: "Double Hit 6",
    		internalName: "StaffDoubleHit6",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2134",
    		name: "Blocking Stance 5",
    		internalName: "BlockingStance5",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2143",
    		name: "Redirect 4",
    		internalName: "Redirect4",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2163",
    		name: "Safe Fall 3",
    		internalName: "SafeFall3",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2195",
    		name: "Deflective Spin 4",
    		internalName: "DeflectiveSpin4",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2199",
    		name: "Pin 5",
    		internalName: "Pin5",
    		skill: "Staff"
    	},
    	{
    		id: "ability_2206",
    		name: "Raise Skeletal Archer 7",
    		internalName: "RaiseSkeletonArcher7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_2214",
    		name: "Raise Skeletal Swordsman 7",
    		internalName: "RaiseSkeletonSwordsman7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_2266",
    		name: "Heart's Power 2",
    		internalName: "HeartsPower2",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_2274",
    		name: "Spleen's Power 2",
    		internalName: "SpleensPower2",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_2326",
    		name: "Multishot 6",
    		internalName: "MultiShot6",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2365",
    		name: "Agonize 5",
    		internalName: "Agonize5",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_2386",
    		name: "Revitalize 6",
    		internalName: "Revitalize6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_2395",
    		name: "Pain Bubble 5",
    		internalName: "PainBubble5",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_2429",
    		name: "Fairy Fire 9",
    		internalName: "FairyFire9",
    		skill: "FairyMagic"
    	},
    	{
    		id: "ability_2445",
    		name: "Astral Strike 5",
    		internalName: "AstralStrike5",
    		skill: "FairyMagic"
    	},
    	{
    		id: "ability_2469",
    		name: "Pixie Flare 9",
    		internalName: "PixieFlare9",
    		skill: "FairyMagic"
    	},
    	{
    		id: "ability_2487",
    		name: "Fae Conduit 7",
    		internalName: "FaeConduit7",
    		skill: "FairyMagic"
    	},
    	{
    		id: "ability_2515",
    		name: "Hook Shot 5",
    		internalName: "HookShot5",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2547",
    		name: "Bow Bash 7",
    		internalName: "BowBash7",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2555",
    		name: "Long Shot 5",
    		internalName: "LongShot5",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2568",
    		name: "Poison Arrow 8",
    		internalName: "PoisonArrow8",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2578",
    		name: "Acid Arrow 8",
    		internalName: "AcidArrow8",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2588",
    		name: "Snare Arrow 8",
    		internalName: "SnareArrow8",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2598",
    		name: "Fire Arrow 8",
    		internalName: "FireArrow8",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2606",
    		name: "Heavy Shot 6",
    		internalName: "HeavyShot6",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2615",
    		name: "Heavy Multishot 5",
    		internalName: "HeavyMultiShot5",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2636",
    		name: "Restorative Arrow 6",
    		internalName: "RestorativeArrow6",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2647",
    		name: "Mangling Shot 7",
    		internalName: "ManglingShot7",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2701",
    		name: "Basic Shot 7 (Energy Bow)",
    		internalName: "BasicShot7B",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2702",
    		name: "Aimed Shot 7 (Energy Bow)",
    		internalName: "AimedShot7B",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2703",
    		name: "Blitz Shot 6 (Energy Bow)",
    		internalName: "BlitzShot6B",
    		skill: "Archery"
    	},
    	{
    		id: "ability_2805",
    		name: "Explosion Sigil 5",
    		internalName: "ExplosionSigil5",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2813",
    		name: "Restorative Sigil 3",
    		internalName: "RestorativeSigil3",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2814",
    		name: "Restorative Sigil 4",
    		internalName: "RestorativeSigil4",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2821",
    		name: "Repulsion Barrier",
    		internalName: "RepulsionBarrier",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2833",
    		name: "Electricity Sigil 3",
    		internalName: "ElectricitySigil3",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2834",
    		name: "Electricity Sigil 4",
    		internalName: "ElectricitySigil4",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2843",
    		name: "Acid Sigil 3",
    		internalName: "AcidSigil3",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2844",
    		name: "Acid Sigil 4",
    		internalName: "AcidSigil4",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2851",
    		name: "Teleportation Sigil",
    		internalName: "TeleportationSigil",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2861",
    		name: "Health Glyph",
    		internalName: "HealthGlyph1",
    		skill: "SigilScripting"
    	},
    	{
    		id: "ability_2928",
    		name: "Insidious Illusion 3",
    		internalName: "SpiderIllusion3",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2936",
    		name: "Webspin",
    		internalName: "Webspin",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2948",
    		name: "Web Trap 2",
    		internalName: "WebTrap2",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2958",
    		name: "Spider Bite 9",
    		internalName: "PlayerSpiderBite9",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2959",
    		name: "Inject Venom 6",
    		internalName: "InjectVenom6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2960",
    		name: "Gripjaw 6",
    		internalName: "Gripjaw6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2961",
    		name: "Premeditated Doom 6",
    		internalName: "PremeditatedDoom6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2962",
    		name: "Terrifying Bite 6",
    		internalName: "SpiderFear6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2963",
    		name: "Grappling Web 6",
    		internalName: "SpiderGrapple6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2964",
    		name: "Spit Acid 6",
    		internalName: "PlayerSpiderAcid6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2965",
    		name: "Incubate 6",
    		internalName: "PlayerSpiderEgg6",
    		skill: "Spider"
    	},
    	{
    		id: "ability_2966",
    		name: "Infinite Legs 8",
    		internalName: "InfiniteLegs8",
    		skill: "Spider"
    	},
    	{
    		id: "ability_3008",
    		name: "Dig Deep 8",
    		internalName: "DigDeep8",
    		skill: "Endurance"
    	},
    	{
    		id: "ability_3018",
    		name: "Push Onward 8",
    		internalName: "PushOnward8",
    		skill: "Endurance"
    	},
    	{
    		id: "ability_3021",
    		name: "Organ Displacement",
    		internalName: "OrganDisplacement",
    		skill: "Teleportation"
    	},
    	{
    		id: "ability_3104",
    		name: "Stake The Heart 4",
    		internalName: "StakeTheHeart4",
    		skill: "Carpentry"
    	},
    	{
    		id: "ability_3255",
    		name: "(internal)",
    		internalName: "SummonSkeletonBalancer",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3258",
    		name: "Raise Skeletal Battle Mage 6",
    		internalName: "RaiseSkeletonMage6",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3273",
    		name: "(Internal - SZ1)",
    		internalName: "SuperZombie1",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3274",
    		name: "(Internal - SZ2)",
    		internalName: "SuperZombie2",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3275",
    		name: "(Internal - SZ3)",
    		internalName: "SuperZombie3",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3276",
    		name: "(Internal - SZ4)",
    		internalName: "SuperZombie4",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3277",
    		name: "(Internal - SZ5)",
    		internalName: "SuperZombie5",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3278",
    		name: "(Internal - SZ6)",
    		internalName: "SuperZombie6",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3279",
    		name: "(Internal - SZ7)",
    		internalName: "SuperZombie7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3280",
    		name: "Raise Skeletal Ratkin Mage 5",
    		internalName: "RaiseRatkinMage5",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3281",
    		name: "Raise Zombie 8",
    		internalName: "CreateZombie8",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3282",
    		name: "Life Crush 7",
    		internalName: "LifeCrush7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3283",
    		name: "Life Steal 7",
    		internalName: "LifeSteal7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3284",
    		name: "Heal Undead 8",
    		internalName: "HealUndead8",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3285",
    		name: "Death's Hold 7",
    		internalName: "DeathsHold7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3286",
    		name: "Provoke Undead 7",
    		internalName: "ProvokeUndead7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3287",
    		name: "Rebuild Undead 8",
    		internalName: "RebuildUndead8",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3288",
    		name: "Deathgaze 7",
    		internalName: "Deathgaze7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3289",
    		name: "Wave of Darkness 6",
    		internalName: "WaveOfDarkness6",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3290",
    		name: "Spark of Death 7",
    		internalName: "SparkOfDeath7",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3291",
    		name: "Free-Summon Skeletal Archer 6",
    		internalName: "FreeSummonSkeletalArcher6",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3292",
    		name: "(Internal - SZ8)",
    		internalName: "SuperZombie8",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3293",
    		name: "Raise Skeletal Ratkin Mage 6",
    		internalName: "RaiseRatkinMage6",
    		skill: "Necromancy"
    	},
    	{
    		id: "ability_3508",
    		name: "Fireball 7",
    		internalName: "Fireball7",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3522",
    		name: "Super Fireball 6",
    		internalName: "SuperFireball6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3537",
    		name: "Molten Veins 6",
    		internalName: "MoltenVeins6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3551",
    		name: "Scintillating Flame 6",
    		internalName: "ScintillatingFlame6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3566",
    		name: "Calefaction 6",
    		internalName: "Calefaction6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3582",
    		name: "Defensive Burst 7",
    		internalName: "DefensiveBurst7",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3596",
    		name: "Ring of Fire 6",
    		internalName: "RingOfFire6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3613",
    		name: "Fire Breath 7",
    		internalName: "FireBreath7",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3625",
    		name: "Flesh to Fuel 5",
    		internalName: "FleshToFuel5",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3658",
    		name: "Frostball 7",
    		internalName: "Frostball7",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3671",
    		name: "Scintillating Frost 6",
    		internalName: "ScintillatingFrost6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3686",
    		name: "Defensive Chill 6",
    		internalName: "DefensiveChill6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3700",
    		name: "Cold Protection 5",
    		internalName: "ColdProtection5",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3715",
    		name: "Wall of Fire 4 (Purple)",
    		internalName: "FireWall4B",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3717",
    		name: "Wall of Fire 6",
    		internalName: "FireWall6",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3732",
    		name: "Room-Temperature Ball 7",
    		internalName: "CrushingBall7",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3743",
    		name: "Flare Fireball 2",
    		internalName: "SoulFireball2",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3745",
    		name: "Flare Fireball 4",
    		internalName: "SoulFireball4",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_3790",
    		name: "(Internal)",
    		internalName: "TriggeredFireWallHeal",
    		skill: "FireMagic"
    	},
    	{
    		id: "ability_4008",
    		name: "Stunning Bash 8",
    		internalName: "StunningBash8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4018",
    		name: "Disrupting Bash 8",
    		internalName: "DisruptingBash8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4027",
    		name: "Infuriating Bash 7",
    		internalName: "InfuriatingBash7",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4038",
    		name: "Emergency Bash 8",
    		internalName: "EmergencyBash8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4045",
    		name: "Strategic Preparation 5",
    		internalName: "StrategicPreparation5",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4054",
    		name: "Elemental Ward 4",
    		internalName: "ElementalWard4",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4068",
    		name: "Reinforce 8",
    		internalName: "Reinforce8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4073",
    		name: "Bulwark Mode 3",
    		internalName: "BulwarkMode3",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4088",
    		name: "Quick Bash 8",
    		internalName: "QuickBash8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4096",
    		name: "Take The Lead 6",
    		internalName: "TakeTheLead6",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4106",
    		name: "Fire Shield 6",
    		internalName: "FireShield6",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4118",
    		name: "Fight Me You Fools 8",
    		internalName: "FightMeYouFools8",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4126",
    		name: "Shield Team 6",
    		internalName: "ShieldTeam6",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4137",
    		name: "Finish It 7",
    		internalName: "FinishIt7",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4147",
    		name: "Rapid Recovery 7",
    		internalName: "RapidRecovery7",
    		skill: "Shield"
    	},
    	{
    		id: "ability_4207",
    		name: "Shrill Command 7",
    		internalName: "ShrillCommand7",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_4215",
    		name: "Unnatural Wrath 5",
    		internalName: "UnnaturalWrath5",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_4224",
    		name: "Clever Trick 4",
    		internalName: "CleverTrick4",
    		skill: "AnimalHandling"
    	},
    	{
    		id: "ability_4419",
    		name: "Rip 9",
    		internalName: "Rip9",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4433",
    		name: "Tear 8",
    		internalName: "Tear8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4448",
    		name: "Wing Vortex 8",
    		internalName: "WingVortex8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4463",
    		name: "Drink Blood 8",
    		internalName: "DrinkBlood8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4478",
    		name: "Virulent Bite 8",
    		internalName: "VirulentBite8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4489",
    		name: "Bat Stability 4",
    		internalName: "BatStability4",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4508",
    		name: "Screech 8",
    		internalName: "Screech8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4523",
    		name: "Sonic Burst 8",
    		internalName: "SonicBurst8",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4536",
    		name: "Confusing Double 6",
    		internalName: "ConfusingDouble6",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_4551",
    		name: "Deathscream 6",
    		internalName: "Deathscream6",
    		skill: "GiantBat"
    	},
    	{
    		id: "ability_5007",
    		name: "Pound 7",
    		internalName: "Pound7",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5016",
    		name: "Pound To Slag 6",
    		internalName: "PoundToSlag6",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5028",
    		name: "Look At My Hammer 8",
    		internalName: "LookAtMyHammer8",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5037",
    		name: "Leaping Smash 7",
    		internalName: "LeapingSmash7",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5046",
    		name: "Rib Shatter 6",
    		internalName: "RibShatter6",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5056",
    		name: "Thunderstrike 6",
    		internalName: "Thunderstrike6",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5065",
    		name: "Discharging Strike 5",
    		internalName: "DischargingStrike5",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5079",
    		name: "Reckless Slam 9",
    		internalName: "RecklessSlam9",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5088",
    		name: "Reverberating Strike 8",
    		internalName: "ReverberatingStrike8",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5098",
    		name: "Seismic Impact 8",
    		internalName: "SeismicImpact8",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5108",
    		name: "Hurl Lightning 8",
    		internalName: "HurlLightning8",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5116",
    		name: "Latent Charge 6",
    		internalName: "LatentCharge6",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5124",
    		name: "Way of the Hammer 4",
    		internalName: "WayOfTheHammer4",
    		skill: "Hammer"
    	},
    	{
    		id: "ability_5219",
    		name: "Heart Thorn 9",
    		internalName: "HeartThorn9",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5228",
    		name: "Rotskin 8",
    		internalName: "Rotskin8",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5238",
    		name: "Delerium 8",
    		internalName: "Delerium8",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5249",
    		name: "Brambleskin 9",
    		internalName: "Brambleskin9",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5258",
    		name: "Cosmic Strike 8",
    		internalName: "CosmicStrike8",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5265",
    		name: "Fill With Bile 5",
    		internalName: "FillWithBile5",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5276",
    		name: "Healing Sanctuary 6",
    		internalName: "HealingSanctuary6",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5286",
    		name: "Regrowth 6",
    		internalName: "Regrowth6",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5294",
    		name: "Energize 4",
    		internalName: "Energize4",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5303",
    		name: "Trackless Steps 3",
    		internalName: "TracklessSteps3",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5315",
    		name: "Hunter's Stride 5",
    		internalName: "HuntersStride5",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5328",
    		name: "Toxinball 8",
    		internalName: "Toxinball8",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5336",
    		name: "Shillelagh 6",
    		internalName: "Shillelagh6",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5346",
    		name: "Cloud Sight 6",
    		internalName: "CloudSight6",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5355",
    		name: "Pulse of Life 5",
    		internalName: "PulseOfLife5",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5367",
    		name: "Rotflesh",
    		internalName: "Rotflesh7",
    		skill: "Druid"
    	},
    	{
    		id: "ability_5401",
    		name: "Ocarina 1",
    		internalName: "Ocarina1",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5402",
    		name: "Ocarina 2",
    		internalName: "Ocarina2",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5403",
    		name: "Ocarina 3",
    		internalName: "Ocarina3",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5404",
    		name: "Ocarina 4",
    		internalName: "Ocarina4",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5405",
    		name: "Ocarina 5",
    		internalName: "Ocarina5",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5406",
    		name: "Ocarina 6",
    		internalName: "Ocarina6",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5407",
    		name: "Lute 1",
    		internalName: "Lute1",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5408",
    		name: "Lute 2",
    		internalName: "Lute2",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5409",
    		name: "Lute 3",
    		internalName: "Lute3",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5410",
    		name: "Lute 4",
    		internalName: "Lute4",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5411",
    		name: "Lute 5",
    		internalName: "Lute5",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5412",
    		name: "Lute 6",
    		internalName: "Lute6",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5413",
    		name: "Drum 1",
    		internalName: "Drum1",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5414",
    		name: "Drum 2",
    		internalName: "Drum2",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5415",
    		name: "Drum 3",
    		internalName: "Drum3",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5416",
    		name: "Drum 4",
    		internalName: "Drum4",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5417",
    		name: "Drum 5",
    		internalName: "Drum5",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5418",
    		name: "Drum 6",
    		internalName: "Drum6",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5419",
    		name: "Tuba 1",
    		internalName: "Tuba1",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5420",
    		name: "Tuba 2",
    		internalName: "Tuba2",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5421",
    		name: "Tuba 3",
    		internalName: "Tuba3",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5422",
    		name: "Tuba 4",
    		internalName: "Tuba4",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5423",
    		name: "Tuba 5",
    		internalName: "Tuba5",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5424",
    		name: "Tuba 6",
    		internalName: "Tuba6",
    		skill: "Performance_Wind"
    	},
    	{
    		id: "ability_5425",
    		name: "Dulcimer 1",
    		internalName: "Dulcimer1",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5426",
    		name: "Dulcimer 2",
    		internalName: "Dulcimer2",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5427",
    		name: "Dulcimer 3",
    		internalName: "Dulcimer3",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5428",
    		name: "Dulcimer 4",
    		internalName: "Dulcimer4",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5429",
    		name: "Dulcimer 5",
    		internalName: "Dulcimer5",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5430",
    		name: "Dulcimer 6",
    		internalName: "Dulcimer6",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5431",
    		name: "Harp 1",
    		internalName: "Harp1",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5432",
    		name: "Harp 2",
    		internalName: "Harp2",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5433",
    		name: "Harp 3",
    		internalName: "Harp3",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5434",
    		name: "Harp 4",
    		internalName: "Harp4",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5435",
    		name: "Harp 5",
    		internalName: "Harp5",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5436",
    		name: "Harp 6",
    		internalName: "Harp6",
    		skill: "Performance_Strings"
    	},
    	{
    		id: "ability_5437",
    		name: "Dance 1",
    		internalName: "Dance1",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5438",
    		name: "Dance 2",
    		internalName: "Dance2",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5439",
    		name: "Dance 3",
    		internalName: "Dance3",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5440",
    		name: "Dance 4",
    		internalName: "Dance4",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5441",
    		name: "Dance 5",
    		internalName: "Dance5",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5442",
    		name: "Dance 6",
    		internalName: "Dance6",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5443",
    		name: "Fairy Chime 1",
    		internalName: "FairyChime1",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5444",
    		name: "Fairy Chime 2",
    		internalName: "FairyChime2",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5445",
    		name: "Fairy Chime 3",
    		internalName: "FairyChime3",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5446",
    		name: "Fairy Chime 4",
    		internalName: "FairyChime4",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5447",
    		name: "Fairy Chime 5",
    		internalName: "FairyChime5",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5448",
    		name: "Fairy Chime 6",
    		internalName: "FairyChime6",
    		skill: "Performance_Percussion"
    	},
    	{
    		id: "ability_5449",
    		name: "Dance 1 (variant B)",
    		internalName: "Dance1B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5450",
    		name: "Dance 2 (variant B)",
    		internalName: "Dance2B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5451",
    		name: "Dance 3 (variant B)",
    		internalName: "Dance3B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5452",
    		name: "Dance 4 (variant B)",
    		internalName: "Dance4B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5453",
    		name: "Dance 5 (variant B)",
    		internalName: "Dance5B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5454",
    		name: "Dance 6 (variant B)",
    		internalName: "Dance6B",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5455",
    		name: "Dance 1 (variant C)",
    		internalName: "Dance1C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5456",
    		name: "Dance 2 (variant C)",
    		internalName: "Dance2C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5457",
    		name: "Dance 3 (variant C)",
    		internalName: "Dance3C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5458",
    		name: "Dance 4 (variant C)",
    		internalName: "Dance4C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5459",
    		name: "Dance 5 (variant C)",
    		internalName: "Dance5C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5460",
    		name: "Dance 6 (variant C)",
    		internalName: "Dance6C",
    		skill: "Performance_Dance"
    	},
    	{
    		id: "ability_5607",
    		name: "Ice Nova 7",
    		internalName: "IceNova7",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5623",
    		name: "Ice Armor 8",
    		internalName: "IceArmor8",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5637",
    		name: "Freeze Solid 7",
    		internalName: "FreezeSolid7",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5653",
    		name: "Ice Spear 9",
    		internalName: "IceSpear9",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5666",
    		name: "Frostbite 6",
    		internalName: "Frostbite6",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5683",
    		name: "Cold Sphere 8",
    		internalName: "ColdSphere8",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5697",
    		name: "Tundra Spikes 7",
    		internalName: "TundraSpikes7",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5717",
    		name: "Blizzard 7",
    		internalName: "Blizzard7",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5733",
    		name: "Ice Lightning 8",
    		internalName: "IceLightning8",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5743",
    		name: "Cryogenic Freeze 3",
    		internalName: "CryogenicFreeze3",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5773",
    		name: "Shardblast 8",
    		internalName: "Shardblast8",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5784",
    		name: "Ice Veins 3B",
    		internalName: "IceVeins3B",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5787",
    		name: "Ice Veins 6",
    		internalName: "IceVeins6",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5804",
    		name: "Cold Protection 9",
    		internalName: "Ice_ColdProtection9",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5816",
    		name: "Chill 6",
    		internalName: "Chill6",
    		skill: "IceMagic"
    	},
    	{
    		id: "ability_5911",
    		name: "Sword Slash 7",
    		internalName: "SwordSlash7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5915",
    		name: "Many Cuts 7",
    		internalName: "ManyCuts7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5919",
    		name: "Parry 7",
    		internalName: "SwordParry7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5923",
    		name: "Wind Strike 7",
    		internalName: "WindStrike7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5926",
    		name: "Finishing Blow 5",
    		internalName: "FinishingBlow5",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5931",
    		name: "Riposte 7",
    		internalName: "Riposte7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5935",
    		name: "Precision Pierce 7",
    		internalName: "PrecisionPierce7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5939",
    		name: "Hacking Blade 5",
    		internalName: "HackingBlade5",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5942",
    		name: "Debilitating Blow 5",
    		internalName: "DebilitatingBlow5",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5946",
    		name: "Decapitate 6",
    		internalName: "Decapitate6",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5951",
    		name: "Flashing Strike 7",
    		internalName: "FlashingStrike7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5955",
    		name: "Thrusting Blade 5",
    		internalName: "ThrustingBlade5",
    		skill: "Sword"
    	},
    	{
    		id: "ability_5959",
    		name: "Heart Piercer 7",
    		internalName: "HeartPiercer7",
    		skill: "Sword"
    	},
    	{
    		id: "ability_6004",
    		name: "Howl Mode",
    		internalName: "WerewolfHowlMode",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6005",
    		name: "(Internal)",
    		internalName: "ShadowFeintInternal",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6016",
    		name: "Pack Attack 5",
    		internalName: "PackAttack5",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6027",
    		name: "Bite 7",
    		internalName: "WerewolfBite7",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6028",
    		name: "Claw 7",
    		internalName: "WerewolfClaw7",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6029",
    		name: "Pouncing Rake 5",
    		internalName: "WerewolfPounce5",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6030",
    		name: "Pouncing Rend 6",
    		internalName: "WerewolfPounce6B",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6031",
    		name: "Sanguine Fangs 7",
    		internalName: "WerewolfSanguineFangs7",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6032",
    		name: "See Red 8",
    		internalName: "SeeRed8",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6033",
    		name: "Smell Fear 6",
    		internalName: "WerewolfSmellFear6",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6035",
    		name: "Double Claw 7",
    		internalName: "WerewolfDoubleClaw7",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6036",
    		name: "Skulk 5",
    		internalName: "WerewolfSkulk5",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6037",
    		name: "Blood of the Pack 6",
    		internalName: "BloodOfThePack6",
    		skill: "Werewolf"
    	},
    	{
    		id: "ability_6114",
    		name: "Deadly Emission 6",
    		internalName: "DeadlyEmission6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6115",
    		name: "Front Kick 8",
    		internalName: "CowKick8",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6116",
    		name: "Stampede 9",
    		internalName: "CowStomp9",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6117",
    		name: "Moo of Calm 6",
    		internalName: "MooOfCalm6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6118",
    		name: "Chew Cud 6",
    		internalName: "ChewCud6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6119",
    		name: "Moo of Determination 6",
    		internalName: "MooOfDetermination6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6120",
    		name: "Bash 6",
    		internalName: "CowBash6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6121",
    		name: "Clobbering Hoof 8",
    		internalName: "ClobberingHoof8",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6122",
    		name: "Tough Hoof 6",
    		internalName: "ToughHoof6",
    		skill: "Cow"
    	},
    	{
    		id: "ability_6206",
    		name: "First Aid Bomb 6",
    		internalName: "FirstAidBomb6",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6207",
    		name: "Resuscitate 2 (Guild)",
    		internalName: "Resuscitate2Guild",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6208",
    		name: "Resuscitate 2 (Hardcore, Guild)",
    		internalName: "Resuscitate2HardcoreGuild",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6209",
    		name: "Resuscitate 2 (Animal, Guild)",
    		internalName: "Resuscitate2AnimalGuild",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6210",
    		name: "Treat Cold Exposure",
    		internalName: "TreatColdExposure",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6213",
    		name: "Set Broken Bone",
    		internalName: "BoneRepair",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6214",
    		name: "Soberize",
    		internalName: "Soberize1",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6215",
    		name: "Emergency Alcohol Treatment",
    		internalName: "EmergencySoberize",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6216",
    		name: "Field Prophylactic",
    		internalName: "FieldProphylactic",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6217",
    		name: "First Aid 9",
    		internalName: "FirstAid9",
    		skill: "FirstAid"
    	},
    	{
    		id: "ability_6307",
    		name: "Terror Dash 3",
    		internalName: "PigDash3",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6312",
    		name: "Pig Punt 5",
    		internalName: "PigPunt5",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6314",
    		name: "Mudbath 5",
    		internalName: "Mudbath5",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6315",
    		name: "Pig Bite 9",
    		internalName: "PigBite9",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6316",
    		name: "Grunt of Abeyance 8",
    		internalName: "GruntOfAbeyance8",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6317",
    		name: "Pig Rend 5",
    		internalName: "PigRend5",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6318",
    		name: "Frenzy 7",
    		internalName: "PigFrenzy7",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6319",
    		name: "Strategic Chomp 6",
    		internalName: "PigChomp6",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6320",
    		name: "Squeal 5",
    		internalName: "Squeal5",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6321",
    		name: "Porcine Alertness 4",
    		internalName: "PorcineAlertness4",
    		skill: "Pig"
    	},
    	{
    		id: "ability_6405",
    		name: "Forest Challenge 5",
    		internalName: "ForestChallenge5",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6416",
    		name: "Deer Bash 8",
    		internalName: "DeerBash8",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6417",
    		name: "Doe Eyes 6",
    		internalName: "DeerBuff6",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6418",
    		name: "Bounding Escape 5",
    		internalName: "DeerDash5",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6419",
    		name: "Antler Slash 9",
    		internalName: "DeerSlash9",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6420",
    		name: "Pummeling Hooves 8",
    		internalName: "DeerPummel8",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6421",
    		name: "Feign Injury",
    		internalName: "FeignInjury",
    		skill: "Deer"
    	},
    	{
    		id: "ability_6609",
    		name: "Opening Thrust 9",
    		internalName: "OpeningThrust9",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6624",
    		name: "Marking Cut 4",
    		internalName: "MarkingCut4",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6648",
    		name: "Blur Cut 8",
    		internalName: "BlurCut8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6665",
    		name: "Poisoner's Cut 5",
    		internalName: "PoisonersCut5",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6686",
    		name: "Fending Blade 6",
    		internalName: "FendingBlade6",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6709",
    		name: "Slice 9",
    		internalName: "Slice9",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6728",
    		name: "Venomstrike 8",
    		internalName: "Venomstrike8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6748",
    		name: "Gut 8",
    		internalName: "Gut8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6768",
    		name: "Hamstring Throw 8",
    		internalName: "HamstringThrow8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6788",
    		name: "Surprise Throw 8",
    		internalName: "SurpriseThrow8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6808",
    		name: "Backstab 8",
    		internalName: "Backstab8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6828",
    		name: "Surge Cut 8",
    		internalName: "SurgeCut8",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6846",
    		name: "Fan of Blades 6",
    		internalName: "FanOfBlades6",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6869",
    		name: "Duelist's Slash 9",
    		internalName: "SliceB9",
    		skill: "Knife"
    	},
    	{
    		id: "ability_6889",
    		name: "Slicing Ice 9",
    		internalName: "RangedSlice9",
    		skill: "Knife"
    	},
    	{
    		id: "ability_7009",
    		name: "Toughen Up 9",
    		internalName: "ToughenUp9",
    		skill: "SurvivalInstincts"
    	},
    	{
    		id: "ability_7024",
    		name: "Lend Grace 4",
    		internalName: "LendGrace4",
    		skill: "SurvivalInstincts"
    	},
    	{
    		id: "ability_7049",
    		name: "Toxic Flesh 9",
    		internalName: "ToxicFlesh9",
    		skill: "SurvivalInstincts"
    	},
    	{
    		id: "ability_7206",
    		name: "Warning Jolt 6",
    		internalName: "WarningJolt6",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7221",
    		name: "Conditioning Shock 6",
    		internalName: "ConditioningShock6",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7236",
    		name: "Apprehend 6",
    		internalName: "Apprehend6",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7251",
    		name: "Lethal Force 6",
    		internalName: "LethalForce6",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7265",
    		name: "Stun Trap 5",
    		internalName: "StunTrap5",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7280",
    		name: "Privacy Field 5",
    		internalName: "PrivacyField5",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7293",
    		name: "Pursuit Mode 3",
    		internalName: "PursuitMode3",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7315",
    		name: "Controlled Burn 5",
    		internalName: "ControlledBurn5",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7329",
    		name: "Coordinated Assault 4",
    		internalName: "CoordinatedAssault4",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7360",
    		name: "Aggression Deterrent 5",
    		internalName: "AggressionDeterrent5",
    		skill: "Warden"
    	},
    	{
    		id: "ability_7409",
    		name: "Nip 9",
    		internalName: "FoxNip9",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7423",
    		name: "Soul Bite 8",
    		internalName: "SoulBite8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7438",
    		name: "Spirit Pounce 8",
    		internalName: "SpiritPounce8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7453",
    		name: "Blur Step 8",
    		internalName: "BlurStep8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7468",
    		name: "Power Glyph 8",
    		internalName: "PowerGlyph8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7483",
    		name: "Galvanize 8",
    		internalName: "Galvanize8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7496",
    		name: "Paradox Trot 6",
    		internalName: "ParadoxTrot6",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7513",
    		name: "Dimensional Snare 8",
    		internalName: "DimensionalSnare8",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7527",
    		name: "Spirit Bolt 7",
    		internalName: "SpiritBolt7",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7540",
    		name: "Trick Fox 5",
    		internalName: "TrickFox5",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_7553",
    		name: "Illusive Guise 3",
    		internalName: "FoxIllusion3",
    		skill: "SpiritFox"
    	},
    	{
    		id: "ability_8002",
    		name: "Psi Power Wave 5",
    		internalName: "PowerWave5",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8008",
    		name: "Electrify 5",
    		internalName: "Electrify5",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8009",
    		name: "Psi Health Wave 6",
    		internalName: "HealthWave6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8010",
    		name: "Psi Armor Wave 6",
    		internalName: "ArmorWave6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8011",
    		name: "Psi Adrenaline Wave 5",
    		internalName: "AdrenalineWave5",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8012",
    		name: "Mindreave 7",
    		internalName: "Mindreave7",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8013",
    		name: "System Shock 6",
    		internalName: "SystemShock6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8014",
    		name: "Reconstruct 6",
    		internalName: "Reconstruct6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8015",
    		name: "Panic Charge 6",
    		internalName: "PanicCharge6",
    		skill: "Mentalism"
    	},
    	{
    		id: "ability_8114",
    		name: "Punch 8",
    		internalName: "Punch8",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8117",
    		name: "Front Kick 7",
    		internalName: "FrontKick7",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8121",
    		name: "Barrage 7",
    		internalName: "Barrage7",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8124",
    		name: "Cobra Strike 6",
    		internalName: "CobraStrike6",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8127",
    		name: "Hip Throw 6",
    		internalName: "HipThrow6",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8131",
    		name: "Jab 8",
    		internalName: "Jab8",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8135",
    		name: "Knee Kick 7",
    		internalName: "KneeKick7",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8138",
    		name: "Bodyslam 6",
    		internalName: "Bodyslam6",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8142",
    		name: "Headbutt 8",
    		internalName: "Headbutt8",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8146",
    		name: "Mamba Strike 6",
    		internalName: "MambaStrike6",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8150",
    		name: "Bruising Blow 6",
    		internalName: "BruisingBlow6",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8155",
    		name: "Slashing Strike 4",
    		internalName: "SlashingStrike4",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8159",
    		name: "Claw Barrage 3",
    		internalName: "ClawBarrage3",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8163",
    		name: "Infuriating Fist 5",
    		internalName: "InfuriatingFist5",
    		skill: "Unarmed"
    	},
    	{
    		id: "ability_8204",
    		name: "Phoenix Strike 5",
    		internalName: "PhoenixStrike5",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8206",
    		name: "Lunge 7",
    		internalName: "StaffLunge7",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8208",
    		name: "Suppress 5",
    		internalName: "Suppress5",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8209",
    		name: "Strategic Thrust 6",
    		internalName: "StrategicThrust6",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8210",
    		name: "Headcracker 5",
    		internalName: "Headcracker5",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8211",
    		name: "Heed The Stick 6",
    		internalName: "HeedTheStick6",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8212",
    		name: "Pinning Slash 4",
    		internalName: "PinningSlash4",
    		skill: "Staff"
    	},
    	{
    		id: "ability_8310",
    		name: "Shoot Darkness Bolt",
    		internalName: "ShootCrossbow9a",
    		skill: "Crossbow"
    	},
    	{
    		id: "ability_8328",
    		name: "Knockback Bolt 8",
    		internalName: "KnockbackBolt8",
    		skill: "Crossbow"
    	},
    	{
    		id: "ability_8348",
    		name: "Fiery Bolt 8",
    		internalName: "FieryBolt8",
    		skill: "Crossbow"
    	},
    	{
    		id: "ability_8368",
    		name: "Acid Bolt 8",
    		internalName: "AcidBolt8",
    		skill: "Crossbow"
    	},
    	{
    		id: "ability_8408",
    		name: "Song of Resurgence 8",
    		internalName: "SongOfResurgence8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8423",
    		name: "Song of Bravery 8",
    		internalName: "SongOfBravery8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8438",
    		name: "Song of Discord 8",
    		internalName: "SongOfDiscord8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8453",
    		name: "Rally 8",
    		internalName: "Rally8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8466",
    		name: "Anthem of Avoidance 6",
    		internalName: "AnthemOfAvoidance6",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8480",
    		name: "Entrancing Lullaby 5",
    		internalName: "EntrancingLullaby5",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8496",
    		name: "Virtuoso's Ballad 6",
    		internalName: "VirtuososBallad6",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8506",
    		name: "Hymn of Resurrection",
    		internalName: "HymnOfResurrection1",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8507",
    		name: "Hymn of Resurrection 2",
    		internalName: "HymnOfResurrection2",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8528",
    		name: "Moment of Resolve 8",
    		internalName: "MomentOfResolve8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8543",
    		name: "Blast of Fury 8",
    		internalName: "BlastOfFury8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8557",
    		name: "Blast of Defiance 7",
    		internalName: "BlastOfDefiance7",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8572",
    		name: "Blast of Despair 7",
    		internalName: "BlastOfDespair7",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8588",
    		name: "Thunderous Note 8",
    		internalName: "ThunderousNote8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8604",
    		name: "Disharmony 9",
    		internalName: "Disharmony9",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8621",
    		name: "(Internal - SoD1)",
    		internalName: "SongOfDiscordInternal1",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8622",
    		name: "(Internal - SoD2)",
    		internalName: "SongOfDiscordInternal2",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8623",
    		name: "(Internal - SoD3)",
    		internalName: "SongOfDiscordInternal3",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8624",
    		name: "(Internal - SoD4)",
    		internalName: "SongOfDiscordInternal4",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8625",
    		name: "(Internal - SoD5)",
    		internalName: "SongOfDiscordInternal5",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8626",
    		name: "(Internal - SoD6)",
    		internalName: "SongOfDiscordInternal6",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8627",
    		name: "(Internal - SoD7)",
    		internalName: "SongOfDiscordInternal7",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8628",
    		name: "(Internal - SoD8)",
    		internalName: "SongOfDiscordInternal8",
    		skill: "Bard"
    	},
    	{
    		id: "ability_8709",
    		name: "Rabbit Scratch 9",
    		internalName: "RabbitScratch9",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8723",
    		name: "Thump 8",
    		internalName: "Thump8",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8736",
    		name: "Bun-Fu Kick 6",
    		internalName: "BunFuKick6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8751",
    		name: "Rabbit's Foot 6",
    		internalName: "RabbitsFoot6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8768",
    		name: "Hare Dash 8",
    		internalName: "HareDash8",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8781",
    		name: "Play Dead 6",
    		internalName: "PlayDead6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8795",
    		name: "Long Ear 5",
    		internalName: "LongEar5",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8811",
    		name: "Carrot Power 6",
    		internalName: "CarrotPower6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8829",
    		name: "Snow Hare Mode 9",
    		internalName: "SnowHare9",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8845",
    		name: "Bun-Fu Strike 5",
    		internalName: "BunFuStrike5",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8866",
    		name: "Love Tap 6",
    		internalName: "LoveTap6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8886",
    		name: "Bun-Fu Blast 6",
    		internalName: "BunFuBlast6",
    		skill: "Rabbit"
    	},
    	{
    		id: "ability_8909",
    		name: "Admonish 9",
    		internalName: "Admonish9",
    		skill: "Priest"
    	},
    	{
    		id: "ability_8928",
    		name: "Castigate 8",
    		internalName: "Castigate8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_8946",
    		name: "Exhilarate 6",
    		internalName: "Exhilarate6",
    		skill: "Priest"
    	},
    	{
    		id: "ability_8968",
    		name: "Mend Flesh 8",
    		internalName: "MendFlesh8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_8982",
    		name: "Unfetter 2",
    		internalName: "Unfetter2",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9009",
    		name: "Corrupt Hate 9",
    		internalName: "CorruptHate9",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9024",
    		name: "Relentless Hope 4",
    		internalName: "RelentlessHope4",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9048",
    		name: "Righteous Flame 8",
    		internalName: "RighteousFlame8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9068",
    		name: "Flamestrike 8",
    		internalName: "Flamestrike8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9088",
    		name: "Triage 8",
    		internalName: "Triage8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9101",
    		name: "(Internal - Triage1)",
    		internalName: "TriageInternal1",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9102",
    		name: "(Internal - Triage2)",
    		internalName: "TriageInternal2",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9103",
    		name: "(Internal - Triage3)",
    		internalName: "TriageInternal3",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9104",
    		name: "(Internal - Triage4)",
    		internalName: "TriageInternal4",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9105",
    		name: "(Internal - Triage5)",
    		internalName: "TriageInternal5",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9106",
    		name: "(Internal - Triage6)",
    		internalName: "TriageInternal6",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9107",
    		name: "(Internal - Triage7)",
    		internalName: "TriageInternal7",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9108",
    		name: "(Internal - Triage8)",
    		internalName: "TriageInternal8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9128",
    		name: "Remedy 8",
    		internalName: "Remedy8",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9142",
    		name: "Tether Soul 2",
    		internalName: "TetherSoul2",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9167",
    		name: "Invigorate 7",
    		internalName: "Invigorate7",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9185",
    		name: "Give Warmth 5",
    		internalName: "GiveWarmth5",
    		skill: "Priest"
    	},
    	{
    		id: "ability_9306",
    		name: "Spade Assault 6",
    		internalName: "SpadeAssault6",
    		skill: "Gardening"
    	},
    	{
    		id: "ability_9317",
    		name: "Pumpkin Bomb 2",
    		internalName: "PumpkinBomb2",
    		skill: "Gardening"
    	},
    	{
    		id: "ability_9332",
    		name: "Pumpkin Turret 2",
    		internalName: "PumpkinTurret2",
    		skill: "Gardening"
    	},
    	{
    		id: "ability_9351",
    		name: "Free-Flutter",
    		internalName: "FreeFlutter1",
    		skill: "Race_Fae"
    	},
    	{
    		id: "ability_9352",
    		name: "Free-Flutter 2",
    		internalName: "FreeFlutter2",
    		skill: "Race_Fae"
    	},
    	{
    		id: "ability_9353",
    		name: "Free-Flutter 3",
    		internalName: "FreeFlutter3",
    		skill: "Race_Fae"
    	}
    ];
    var items = [
    	{
    		id: "item_40001",
    		name: "Moldy Ancient Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40002",
    		name: "Basic Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40003",
    		name: "Comfortable Ancient Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40005",
    		name: "Sturdy Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40006",
    		name: "Goblin Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40007",
    		name: "Goblin Stompers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40009",
    		name: "Quality Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40010",
    		name: "Featherweights",
    		slot: "Feet"
    	},
    	{
    		id: "item_40011",
    		name: "Hateboots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40012",
    		name: "Flat Footers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40013",
    		name: "Ruggedized Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40015",
    		name: "Flower Dainties",
    		slot: "Feet"
    	},
    	{
    		id: "item_40017",
    		name: "Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40018",
    		name: "Pig Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40019",
    		name: "Echur's Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40020",
    		name: "Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40021",
    		name: "Shoddy Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40022",
    		name: "Rough Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40023",
    		name: "Crude Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40024",
    		name: "Decent Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40025",
    		name: "Nice Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40026",
    		name: "Quality Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40027",
    		name: "Great Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40028",
    		name: "Amazing Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40029",
    		name: "Astounding Leather Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40041",
    		name: "Shoddy Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40042",
    		name: "Rough Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40043",
    		name: "Crude Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40044",
    		name: "Decent Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40045",
    		name: "Nice Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40046",
    		name: "Quality Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40047",
    		name: "Great Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40048",
    		name: "Amazing Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40061",
    		name: "Shoddy Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40062",
    		name: "Rough Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40063",
    		name: "Crude Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40064",
    		name: "Decent Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40065",
    		name: "Nice Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40066",
    		name: "Quality Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40067",
    		name: "Great Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40068",
    		name: "Amazing Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40071",
    		name: "Shoddy Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40072",
    		name: "Rough Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40073",
    		name: "Crude Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40074",
    		name: "Decent Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40075",
    		name: "Nice Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40076",
    		name: "Quality Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40077",
    		name: "Great Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40078",
    		name: "Amazing Wooden Cow Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40081",
    		name: "Shoddy Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40082",
    		name: "Rough Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40083",
    		name: "Crude Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40084",
    		name: "Decent Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40085",
    		name: "Nice Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40086",
    		name: "Quality Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40087",
    		name: "Great Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40088",
    		name: "Amazing Wooden Deer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40101",
    		name: "Shadow Trotters",
    		slot: "Feet"
    	},
    	{
    		id: "item_40102",
    		name: "Insulated Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40103",
    		name: "Orcish Rugged Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40104",
    		name: "Discarded Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40105",
    		name: "Slimy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40106",
    		name: "Web-Encrusted Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40107",
    		name: "Ruined Shifter's Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40108",
    		name: "Yarn Socks",
    		slot: "Feet"
    	},
    	{
    		id: "item_40109",
    		name: "Elven Plate Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40110",
    		name: "Boots of the Winter Court",
    		slot: "Feet"
    	},
    	{
    		id: "item_40111",
    		name: "Dwarven Soldier Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40112",
    		name: "Ciervos's Anklets",
    		slot: "Feet"
    	},
    	{
    		id: "item_40113",
    		name: "Boots of the Summer Court",
    		slot: "Feet"
    	},
    	{
    		id: "item_40114",
    		name: "Booties of Hateful Comeuppance",
    		slot: "Feet"
    	},
    	{
    		id: "item_40115",
    		name: "Ravana Soldier Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40116",
    		name: "Windstep Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40117",
    		name: "Basic Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40118",
    		name: "Sturdy Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40119",
    		name: "Quality Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40120",
    		name: "Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40121",
    		name: "Stalwart Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40122",
    		name: "Tough Old Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40123",
    		name: "Crude Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40124",
    		name: "Decent Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40125",
    		name: "Nice Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40126",
    		name: "Quality Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40127",
    		name: "Great Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40128",
    		name: "Amazing Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40129",
    		name: "Astounding Evasion Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40151",
    		name: "Decent Snail Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40152",
    		name: "Nice Snail Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40153",
    		name: "Quality Snail Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40154",
    		name: "Great Snail Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40155",
    		name: "Amazing Snail Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40201",
    		name: "Nice Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40202",
    		name: "Quality Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40203",
    		name: "Great Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40204",
    		name: "Amazing Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40205",
    		name: "Astounding Spring Fairy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40221",
    		name: "Shoddy Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40222",
    		name: "Rough Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40223",
    		name: "Crude Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40224",
    		name: "Decent Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40225",
    		name: "Nice Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40226",
    		name: "Quality Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40227",
    		name: "Great Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40228",
    		name: "Amazing Werewolf Hind Leg Guards",
    		slot: "Feet"
    	},
    	{
    		id: "item_40241",
    		name: "Shoddy Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40242",
    		name: "Rough Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40243",
    		name: "Crude Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40244",
    		name: "Decent Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40245",
    		name: "Nice Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40246",
    		name: "Quality Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40247",
    		name: "Great Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40248",
    		name: "Amazing Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40249",
    		name: "Astounding Cloth Slippers",
    		slot: "Feet"
    	},
    	{
    		id: "item_40264",
    		name: "Decent Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40265",
    		name: "Nice Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40266",
    		name: "Quality Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40267",
    		name: "Great Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40268",
    		name: "Amazing Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40269",
    		name: "Astounding Winter Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40286",
    		name: "Quality Bard Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40287",
    		name: "Great Bard Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40288",
    		name: "Amazing Bard Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40289",
    		name: "Astounding Bard Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40301",
    		name: "Desert Vagabond Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40302",
    		name: "Rakshasian Elite Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40303",
    		name: "Yeti Stockings",
    		slot: "Feet"
    	},
    	{
    		id: "item_40304",
    		name: "Basic Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40305",
    		name: "Insulated Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40306",
    		name: "Thentree Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40307",
    		name: "Great Boots of the Winter Court",
    		slot: "Feet"
    	},
    	{
    		id: "item_40308",
    		name: "Peltast Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40309",
    		name: "Mortimer's Booties",
    		slot: "Feet"
    	},
    	{
    		id: "item_40310",
    		name: "Hooves of the Inamorata",
    		slot: "Feet"
    	},
    	{
    		id: "item_40311",
    		name: "Scorpiclaw Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40312",
    		name: "General Pask's Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40313",
    		name: "Cheap Goblin Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40314",
    		name: "Orcish Military Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40315",
    		name: "Snowblood Misery Trooper Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40316",
    		name: "Orcish Magic Trooper Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40317",
    		name: "Lyramis Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40318",
    		name: "Death Trooper Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40319",
    		name: "Misery Trooper Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40320",
    		name: "Treachery Trooper Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40321",
    		name: "Gazluk Officer Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40322",
    		name: "War-Wizard Officer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40323",
    		name: "Mutterer Necromancer Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40324",
    		name: "Mutterer Cabalist Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40325",
    		name: "Ratkin Revolutionist Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40326",
    		name: "Council Pathfinder Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40327",
    		name: "Winter Court Battle-Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40328",
    		name: "Winter Court Murder-Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40329",
    		name: "Symbol-Etched Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40330",
    		name: "Seashell Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40331",
    		name: "Fancy Seashell Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40332",
    		name: "Extra-Fancy Seashell Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40334",
    		name: "Kelp Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40335",
    		name: "Tough Kelp Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40336",
    		name: "Slimy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40337",
    		name: "Fae Navy Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40338",
    		name: "Rubgag's Dancing Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40339",
    		name: "Niphian Boots",
    		slot: "Feet"
    	},
    	{
    		id: "item_40404",
    		name: "Decent Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40405",
    		name: "Nice Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40406",
    		name: "Quality Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40407",
    		name: "Great Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40408",
    		name: "Amazing Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40409",
    		name: "Astounding Nimble Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_40420",
    		name: "Enhanced Windstep Shoes",
    		slot: "Feet"
    	},
    	{
    		id: "item_41001",
    		name: "Moldy Ancient Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41002",
    		name: "Basic Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41003",
    		name: "Comfortable Ancient Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41004",
    		name: "Rita's Lucky Underpants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41005",
    		name: "Sturdy Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41006",
    		name: "Goblin Skirt",
    		slot: "Legs"
    	},
    	{
    		id: "item_41007",
    		name: "Goblin Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41008",
    		name: "Nightmare Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41009",
    		name: "Quality Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41011",
    		name: "Pants of the Yearning Sea",
    		slot: "Legs"
    	},
    	{
    		id: "item_41012",
    		name: "Makopa's Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41013",
    		name: "Rita's Disturbing Dimensional Panties",
    		slot: "Legs"
    	},
    	{
    		id: "item_41014",
    		name: "Ivyn's Family Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41015",
    		name: "Ukorga's Experimental Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41016",
    		name: "General Lawyr's Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41020",
    		name: "Sir Coth's Discarded Gift",
    		slot: "Legs"
    	},
    	{
    		id: "item_41021",
    		name: "Crude Underwear",
    		slot: "Legs"
    	},
    	{
    		id: "item_41022",
    		name: "Ancient Slacks",
    		slot: "Legs"
    	},
    	{
    		id: "item_41023",
    		name: "Long-Lost Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41024",
    		name: "Web-Encrusted Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41025",
    		name: "Cotton Long Underwear",
    		slot: "Legs"
    	},
    	{
    		id: "item_41026",
    		name: "Long Stockings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41027",
    		name: "Orcish Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41028",
    		name: "Elven Plate Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41029",
    		name: "Greaves of the Winter Court",
    		slot: "Legs"
    	},
    	{
    		id: "item_41030",
    		name: "Dwarven Soldier Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41031",
    		name: "Greaves of the Summer Court",
    		slot: "Legs"
    	},
    	{
    		id: "item_41032",
    		name: "Pants of Hateful Comeuppance",
    		slot: "Legs"
    	},
    	{
    		id: "item_41033",
    		name: "Ravana Soldier Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41034",
    		name: "Idealist's Skirts",
    		slot: "Legs"
    	},
    	{
    		id: "item_41035",
    		name: "Basic Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41036",
    		name: "Sturdy Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41037",
    		name: "Quality Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41038",
    		name: "Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41039",
    		name: "Stalwart Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41040",
    		name: "Great Greaves of the Winter Court",
    		slot: "Legs"
    	},
    	{
    		id: "item_41041",
    		name: "Shoddy Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41042",
    		name: "Rough Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41043",
    		name: "Crude Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41044",
    		name: "Decent Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41045",
    		name: "Nice Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41046",
    		name: "Quality Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41047",
    		name: "Great Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41048",
    		name: "Amazing Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41049",
    		name: "Astounding Leather Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41051",
    		name: "Ancient Slacks",
    		slot: "Legs"
    	},
    	{
    		id: "item_41063",
    		name: "Crude Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41064",
    		name: "Decent Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41065",
    		name: "Nice Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41066",
    		name: "Quality Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41067",
    		name: "Great Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41068",
    		name: "Amazing Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41069",
    		name: "Astounding Evasion Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41084",
    		name: "Decent Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41085",
    		name: "Nice Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41086",
    		name: "Quality Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41087",
    		name: "Great Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41088",
    		name: "Amazing Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41089",
    		name: "Astounding Winter Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41101",
    		name: "Shoddy Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41102",
    		name: "Rough Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41103",
    		name: "Crude Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41104",
    		name: "Decent Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41105",
    		name: "Nice Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41106",
    		name: "Quality Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41107",
    		name: "Great Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41108",
    		name: "Amazing Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41109",
    		name: "Astounding Cloth Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41151",
    		name: "Camouflaged Crude Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41152",
    		name: "Camouflaged Decent Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41153",
    		name: "Camouflaged Nice Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41154",
    		name: "Camouflaged Quality Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41155",
    		name: "Camouflaged Great Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41156",
    		name: "Camouflaged Amazing Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41157",
    		name: "Camouflaged Astounding Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41171",
    		name: "Decent Snail Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41172",
    		name: "Nice Snail Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41173",
    		name: "Quality Snail Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41174",
    		name: "Great Snail Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41175",
    		name: "Amazing Snail Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41201",
    		name: "Nice Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41202",
    		name: "Quality Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41203",
    		name: "Great Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41204",
    		name: "Amazing Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41205",
    		name: "Astounding Spring Fairy Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41221",
    		name: "Shoddy Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41222",
    		name: "Rough Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41223",
    		name: "Crude Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41224",
    		name: "Decent Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41225",
    		name: "Nice Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41226",
    		name: "Quality Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41227",
    		name: "Great Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41228",
    		name: "Amazing Werewolf Hindguard",
    		slot: "Legs"
    	},
    	{
    		id: "item_41246",
    		name: "Quality Bard Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41247",
    		name: "Great Bard Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41248",
    		name: "Amazing Bard Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41249",
    		name: "Astounding Bard Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41264",
    		name: "Decent Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41265",
    		name: "Nice Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41266",
    		name: "Quality Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41267",
    		name: "Great Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41268",
    		name: "Amazing Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41269",
    		name: "Astounding Nimble Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41281",
    		name: "Quality Ri-Shin Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41282",
    		name: "Great Ri-Shin Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41283",
    		name: "Amazing Ri-Shin Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41284",
    		name: "Astounding Ri-Shin Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41301",
    		name: "Desert Vagabond Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41302",
    		name: "Rakshasian Elite Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41303",
    		name: "Yeti Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41304",
    		name: "Basic Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41305",
    		name: "Thentree Skirt",
    		slot: "Legs"
    	},
    	{
    		id: "item_41306",
    		name: "Goblin Kilt",
    		slot: "Legs"
    	},
    	{
    		id: "item_41307",
    		name: "Peltast Kilt",
    		slot: "Legs"
    	},
    	{
    		id: "item_41308",
    		name: "Insulated Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41309",
    		name: "Scorpiclaw Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41310",
    		name: "General Pask's Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41311",
    		name: "Cheap Goblin Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41312",
    		name: "Orcish Military Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41313",
    		name: "Snowblood Misery Trooper Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41314",
    		name: "Orcish Magic Trooper Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41315",
    		name: "McNasty Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41316",
    		name: "Death Trooper Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41317",
    		name: "Misery Trooper Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41318",
    		name: "Treachery Trooper Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41319",
    		name: "Gazluk Officer Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41320",
    		name: "War-Wizard Officer Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41321",
    		name: "Mutterer Necromancer Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41322",
    		name: "Mutterer Cabalist Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41323",
    		name: "Elegant Cotton Skirt",
    		slot: "Legs"
    	},
    	{
    		id: "item_41324",
    		name: "Ratkin Revolutionist Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41325",
    		name: "Council Pathfinder Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41326",
    		name: "Winter Court Battle-Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41327",
    		name: "Winter Court Murder-Greaves",
    		slot: "Legs"
    	},
    	{
    		id: "item_41328",
    		name: "Birch Pants",
    		slot: "Legs"
    	},
    	{
    		id: "item_41329",
    		name: "Seashell Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41330",
    		name: "Fancy Seashell Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41331",
    		name: "Extra-Fancy Seashell Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41333",
    		name: "Kelp Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41334",
    		name: "Tough Kelp Leggings",
    		slot: "Legs"
    	},
    	{
    		id: "item_41335",
    		name: "Fae Navy Harness",
    		slot: "Legs"
    	},
    	{
    		id: "item_41336",
    		name: "Captain Evergloam's Harness",
    		slot: "Legs"
    	},
    	{
    		id: "item_42001",
    		name: "Moldy Ancient Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42002",
    		name: "Basic Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42003",
    		name: "Comfortable Ancient Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42005",
    		name: "Sturdy Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42006",
    		name: "Goblin Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42007",
    		name: "Goblin Chain Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42009",
    		name: "Quality Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42010",
    		name: "Snail Plate Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42011",
    		name: "Robes of Malediction",
    		slot: "Chest"
    	},
    	{
    		id: "item_42012",
    		name: "Everpatching Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42013",
    		name: "Knight's Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42014",
    		name: "Tiger-Urine-Encrusted Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42015",
    		name: "Lawara's Mangled Platemail",
    		slot: "Chest"
    	},
    	{
    		id: "item_42017",
    		name: "Elven Ceremonial Suit",
    		slot: "Chest"
    	},
    	{
    		id: "item_42018",
    		name: "Moldy Ancient Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42023",
    		name: "Leafy Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42027",
    		name: "Crude Undershirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42028",
    		name: "Sturdy Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42029",
    		name: "Extra-Sturdy Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42030",
    		name: "Corroded Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42031",
    		name: "Spider-Worn Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42032",
    		name: "Hunter's Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42033",
    		name: "Cotton Undershirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42034",
    		name: "Silver-Threaded Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42035",
    		name: "Orcish Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42036",
    		name: "Coat of the Winter Court",
    		slot: "Chest"
    	},
    	{
    		id: "item_42037",
    		name: "Dwarven Soldier Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42038",
    		name: "Coat of the Summer Court",
    		slot: "Chest"
    	},
    	{
    		id: "item_42039",
    		name: "Robes of Hateful Comeuppance",
    		slot: "Chest"
    	},
    	{
    		id: "item_42040",
    		name: "Ravana Soldier Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42041",
    		name: "Thickened Chainmail Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42042",
    		name: "Basic Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42043",
    		name: "Sturdy Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42044",
    		name: "Quality Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42045",
    		name: "Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42046",
    		name: "Stalwart Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42047",
    		name: "Harness of Poisons",
    		slot: "Chest"
    	},
    	{
    		id: "item_42048",
    		name: "Syndra's Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42049",
    		name: "Desert Vagabond Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42050",
    		name: "Rakshasian Elite Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42051",
    		name: "Yeti Jacket",
    		slot: "Chest"
    	},
    	{
    		id: "item_42052",
    		name: "Basic Breastplate",
    		slot: "Chest"
    	},
    	{
    		id: "item_42053",
    		name: "Thentree Harness",
    		slot: "Chest"
    	},
    	{
    		id: "item_42054",
    		name: "Great Coat of the Winter Court",
    		slot: "Chest"
    	},
    	{
    		id: "item_42055",
    		name: "Peltast Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42056",
    		name: "Insulated Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42057",
    		name: "Scorpiclaw Suit",
    		slot: "Chest"
    	},
    	{
    		id: "item_42058",
    		name: "General Pask's Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42059",
    		name: "Cheap Goblin Chain Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42060",
    		name: "Shirogin's Practice Gown",
    		slot: "Chest"
    	},
    	{
    		id: "item_42061",
    		name: "Orcish Military Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42062",
    		name: "Snowblood Misery Trooper Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42063",
    		name: "Orcish Magic Trooper Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42064",
    		name: "Suave Mage Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42065",
    		name: "Death Trooper Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42066",
    		name: "Misery Trooper Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42067",
    		name: "Treachery Trooper Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42068",
    		name: "Gazluk Officer Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42069",
    		name: "War-Wizard Officer Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42070",
    		name: "Mutterer Necromancer Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42071",
    		name: "Mutterer Cabalist Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42072",
    		name: "Eveline's Tailored Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42073",
    		name: "Ratkin Revolutionist Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42074",
    		name: "Council Pathfinder Armor",
    		slot: "Chest"
    	},
    	{
    		id: "item_42075",
    		name: "Winter Court Battle-Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42076",
    		name: "Winter Court Murder-Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42077",
    		name: "Barghest-Hide Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42078",
    		name: "Seashell Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42079",
    		name: "Fancy Seashell Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42080",
    		name: "Extra-Fancy Seashell Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42082",
    		name: "Kelp Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42083",
    		name: "Tough Kelp Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42084",
    		name: "Everpatching Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42085",
    		name: "Scrayskin Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42086",
    		name: "Fae Navy Jumpsuit",
    		slot: "Chest"
    	},
    	{
    		id: "item_42101",
    		name: "Shoddy Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42102",
    		name: "Rough Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42103",
    		name: "Crude Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42104",
    		name: "Decent Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42105",
    		name: "Nice Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42106",
    		name: "Quality Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42107",
    		name: "Great Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42108",
    		name: "Amazing Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42109",
    		name: "Astounding Leather Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42144",
    		name: "Decent Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42145",
    		name: "Nice Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42146",
    		name: "Quality Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42147",
    		name: "Great Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42148",
    		name: "Amazing Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42149",
    		name: "Astounding Winter Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42163",
    		name: "Crude Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42164",
    		name: "Decent Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42165",
    		name: "Nice Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42166",
    		name: "Quality Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42167",
    		name: "Great Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42168",
    		name: "Amazing Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42169",
    		name: "Astounding Evasion Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42186",
    		name: "Quality Bard Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42187",
    		name: "Great Bard Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42188",
    		name: "Amazing Bard Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42189",
    		name: "Astounding Bard Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42201",
    		name: "Shoddy Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42202",
    		name: "Rough Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42203",
    		name: "Crude Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42204",
    		name: "Decent Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42205",
    		name: "Nice Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42206",
    		name: "Quality Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42207",
    		name: "Great Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42208",
    		name: "Amazing Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42209",
    		name: "Astounding Cloth Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42253",
    		name: "Camouflaged Crude Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42254",
    		name: "Camouflaged Decent Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42255",
    		name: "Camouflaged Nice Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42256",
    		name: "Camouflaged Quality Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42257",
    		name: "Camouflaged Great Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42258",
    		name: "Camouflaged Amazing Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42259",
    		name: "Camouflaged Astounding Shirt",
    		slot: "Chest"
    	},
    	{
    		id: "item_42271",
    		name: "Decent Snail Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42272",
    		name: "Nice Snail Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42273",
    		name: "Quality Snail Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42274",
    		name: "Great Snail Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42275",
    		name: "Amazing Snail Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42291",
    		name: "Decent Cow Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42292",
    		name: "Nice Cow Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42293",
    		name: "Quality Cow Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42294",
    		name: "Great Cow Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42295",
    		name: "Amazing Cow Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42331",
    		name: "Nice Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42332",
    		name: "Quality Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42333",
    		name: "Great Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42334",
    		name: "Amazing Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42335",
    		name: "Astounding Spring Fairy Top",
    		slot: "Chest"
    	},
    	{
    		id: "item_42351",
    		name: "Shoddy Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42352",
    		name: "Rough Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42353",
    		name: "Crude Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42354",
    		name: "Decent Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42355",
    		name: "Nice Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42356",
    		name: "Quality Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42357",
    		name: "Great Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42358",
    		name: "Amazing Werewolf Barding",
    		slot: "Chest"
    	},
    	{
    		id: "item_42371",
    		name: "Shoddy Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42372",
    		name: "Rough Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42373",
    		name: "Crude Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42374",
    		name: "Decent Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42375",
    		name: "Nice Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42376",
    		name: "Quality Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42377",
    		name: "Great Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42378",
    		name: "Amazing Spider Casing",
    		slot: "Chest"
    	},
    	{
    		id: "item_42384",
    		name: "Decent Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42385",
    		name: "Nice Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42386",
    		name: "Quality Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42387",
    		name: "Great Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42388",
    		name: "Amazing Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42389",
    		name: "Astounding Nimble Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42401",
    		name: "Quality Ri-Shin Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42402",
    		name: "Great Ri-Shin Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42403",
    		name: "Amazing Ri-Shin Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_42404",
    		name: "Astounding Ri-Shin Coat",
    		slot: "Chest"
    	},
    	{
    		id: "item_43001",
    		name: "Moldy Ancient Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43002",
    		name: "Basic Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43003",
    		name: "Comfortable Ancient Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43004",
    		name: "Velkort's Classy Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43005",
    		name: "Sturdy Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43006",
    		name: "Grouper Grippers",
    		slot: "Hands"
    	},
    	{
    		id: "item_43007",
    		name: "Slightly Rusty Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43008",
    		name: "Goblin Fist Wraps",
    		slot: "Hands"
    	},
    	{
    		id: "item_43009",
    		name: "Quality Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43011",
    		name: "Grouper Gropers",
    		slot: "Hands"
    	},
    	{
    		id: "item_43012",
    		name: "Spiked Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43013",
    		name: "Republic Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43014",
    		name: "Goblin Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43015",
    		name: "Fey Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43016",
    		name: "Ursula's Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43017",
    		name: "Temperature Control Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43018",
    		name: "Nameless Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43021",
    		name: "Shoddy Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43022",
    		name: "Rough Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43023",
    		name: "Crude Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43024",
    		name: "Decent Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43025",
    		name: "Nice Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43026",
    		name: "Quality Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43027",
    		name: "Great Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43028",
    		name: "Amazing Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43029",
    		name: "Astounding Leather Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43031",
    		name: "Orcish Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43032",
    		name: "Gauntlets of the Winter Court",
    		slot: "Hands"
    	},
    	{
    		id: "item_43033",
    		name: "Dwarven Soldier Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43034",
    		name: "Gauntlets of the Summer Court",
    		slot: "Hands"
    	},
    	{
    		id: "item_43035",
    		name: "Orcish Gladiator Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43036",
    		name: "Basic Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43037",
    		name: "Sturdy Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43038",
    		name: "Quality Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43039",
    		name: "Venom Piercers",
    		slot: "Hands"
    	},
    	{
    		id: "item_43040",
    		name: "Stalwart Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43041",
    		name: "Thentree Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43042",
    		name: "Great Gauntlets of the Winter Court",
    		slot: "Hands"
    	},
    	{
    		id: "item_43043",
    		name: "Temperature Control Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43044",
    		name: "Peltast Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43045",
    		name: "Goblin Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43056",
    		name: "Cheap Goblin Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43057",
    		name: "Orcish Military Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43058",
    		name: "Snowblood Misery Trooper Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43059",
    		name: "Orcish Magic Trooper Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43060",
    		name: "Ice Hands",
    		slot: "Hands"
    	},
    	{
    		id: "item_43061",
    		name: "Death Trooper Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43062",
    		name: "Misery Trooper Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43063",
    		name: "Treachery Trooper Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43064",
    		name: "Gazluk Officer Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43065",
    		name: "War-Wizard Officer Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43066",
    		name: "Mutterer Necromancer Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43067",
    		name: "Mutterer Cabalist Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43068",
    		name: "Ratkin Revolutionist Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43069",
    		name: "Council Pathfinder Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43070",
    		name: "Winter Court Battle-Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43071",
    		name: "Winter Court Murder-Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43072",
    		name: "Felmer's Famous Fingerfangles",
    		slot: "Hands"
    	},
    	{
    		id: "item_43073",
    		name: "Seashell Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43074",
    		name: "Fancy Seashell Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43075",
    		name: "Extra-Fancy Seashell Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43077",
    		name: "Kelp Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43078",
    		name: "Tough Kelp Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43079",
    		name: "Goblin Fist Wraps",
    		slot: "Hands"
    	},
    	{
    		id: "item_43080",
    		name: "Fae Navy Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43101",
    		name: "Ukorga's Furry Fistwraps",
    		slot: "Hands"
    	},
    	{
    		id: "item_43102",
    		name: "Ruggedized Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43103",
    		name: "Graz's Shackles",
    		slot: "Hands"
    	},
    	{
    		id: "item_43104",
    		name: "Legacy Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43105",
    		name: "Webbed-Up Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43106",
    		name: "Claws of the Undone Beast",
    		slot: "Hands"
    	},
    	{
    		id: "item_43107",
    		name: "Cotton Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43108",
    		name: "Elven Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43109",
    		name: "Gloves of Hateful Comeuppance",
    		slot: "Hands"
    	},
    	{
    		id: "item_43110",
    		name: "Ravana Soldier Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43111",
    		name: "Jumjab's Necrogloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43112",
    		name: "Desert Vagabond Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43113",
    		name: "Rakshasian Elite Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43115",
    		name: "Yeti Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43116",
    		name: "Basic Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43117",
    		name: "Insulated Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43118",
    		name: "Scorpiclaw Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43119",
    		name: "General Pask's Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43120",
    		name: "Rahu Society Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43121",
    		name: "Decent Snail Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43122",
    		name: "Nice Snail Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43123",
    		name: "Quality Snail Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43124",
    		name: "Great Snail Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43125",
    		name: "Amazing Snail Gauntlets",
    		slot: "Hands"
    	},
    	{
    		id: "item_43141",
    		name: "Shoddy Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43142",
    		name: "Rough Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43143",
    		name: "Crude Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43144",
    		name: "Decent Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43145",
    		name: "Nice Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43146",
    		name: "Quality Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43147",
    		name: "Great Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43148",
    		name: "Amazing Werewolf Foreguards",
    		slot: "Hands"
    	},
    	{
    		id: "item_43161",
    		name: "Shoddy Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43162",
    		name: "Rough Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43163",
    		name: "Crude Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43164",
    		name: "Decent Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43165",
    		name: "Nice Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43166",
    		name: "Quality Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43167",
    		name: "Great Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43168",
    		name: "Amazing Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43169",
    		name: "Astounding Cloth Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43184",
    		name: "Decent Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43185",
    		name: "Nice Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43186",
    		name: "Quality Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43187",
    		name: "Great Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43188",
    		name: "Amazing Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43189",
    		name: "Astounding Winter Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43201",
    		name: "Quality Bard Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43202",
    		name: "Great Bard Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43203",
    		name: "Amazing Bard Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43204",
    		name: "Astounding Bard Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43221",
    		name: "Decent Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43222",
    		name: "Nice Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43223",
    		name: "Quality Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43224",
    		name: "Great Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43225",
    		name: "Amazing Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_43226",
    		name: "Astounding Nimble Gloves",
    		slot: "Hands"
    	},
    	{
    		id: "item_44001",
    		name: "Moldy Ancient Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44002",
    		name: "Basic Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44003",
    		name: "Comfortable Ancient Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44004",
    		name: "Brainwave Safety Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44005",
    		name: "Sturdy Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44007",
    		name: "Skullcap",
    		slot: "Head"
    	},
    	{
    		id: "item_44008",
    		name: "Goblin Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44009",
    		name: "Quality Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44010",
    		name: "Mantis Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44011",
    		name: "Jaunty Hat of Despair",
    		slot: "Head"
    	},
    	{
    		id: "item_44012",
    		name: "Knight's Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44014",
    		name: "Flanged Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44015",
    		name: "Ugly Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44016",
    		name: "Web-Coated Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44017",
    		name: "Cotton Balaclava",
    		slot: "Head"
    	},
    	{
    		id: "item_44018",
    		name: "Thimble Pete's Awful Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44019",
    		name: "Orcish Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44020",
    		name: "Elven Officer's Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44021",
    		name: "Shoddy Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44022",
    		name: "Rough Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44023",
    		name: "Crude Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44024",
    		name: "Decent Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44025",
    		name: "Nice Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44026",
    		name: "Quality Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44027",
    		name: "Great Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44028",
    		name: "Amazing Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44029",
    		name: "Astounding Leather Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44031",
    		name: "Jaunty Hat of Despair",
    		slot: "Head"
    	},
    	{
    		id: "item_44046",
    		name: "Quality Bard Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44047",
    		name: "Great Bard Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44048",
    		name: "Amazing Bard Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44049",
    		name: "Astounding Bard Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44201",
    		name: "Helm of the Winter Court",
    		slot: "Head"
    	},
    	{
    		id: "item_44202",
    		name: "Coif of Calamities",
    		slot: "Head"
    	},
    	{
    		id: "item_44203",
    		name: "Intellect Augmentation Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44204",
    		name: "Dwarven Soldier Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44205",
    		name: "Helm of the Summer Court",
    		slot: "Head"
    	},
    	{
    		id: "item_44206",
    		name: "Hood of Hateful Comeuppance",
    		slot: "Head"
    	},
    	{
    		id: "item_44207",
    		name: "Indestructible Fae Knight's Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44208",
    		name: "Ravana Soldier Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44209",
    		name: "Orcish Gladiator Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44210",
    		name: "Basic Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44211",
    		name: "Sturdy Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44212",
    		name: "Quality Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44213",
    		name: "Goblin Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44214",
    		name: "Snail Mother's Face",
    		slot: "Head"
    	},
    	{
    		id: "item_44215",
    		name: "Stalwart Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44216",
    		name: "Desert Vagabond Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44217",
    		name: "Rakshasian Elite Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44218",
    		name: "Yeti Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44219",
    		name: "Basic Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44220",
    		name: "Thentree Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44221",
    		name: "Decent Snail Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44222",
    		name: "Nice Snail Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44223",
    		name: "Quality Snail Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44224",
    		name: "Great Snail Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44225",
    		name: "Amazing Snail Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44241",
    		name: "Decent Cow Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44242",
    		name: "Nice Cow Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44243",
    		name: "Quality Cow Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44244",
    		name: "Great Cow Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44245",
    		name: "Amazing Cow Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44261",
    		name: "Shoddy Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44262",
    		name: "Rough Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44263",
    		name: "Crude Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44264",
    		name: "Decent Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44265",
    		name: "Nice Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44266",
    		name: "Quality Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44267",
    		name: "Great Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44268",
    		name: "Amazing Werewolf Champron",
    		slot: "Head"
    	},
    	{
    		id: "item_44281",
    		name: "Shoddy Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44282",
    		name: "Rough Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44283",
    		name: "Crude Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44284",
    		name: "Decent Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44285",
    		name: "Nice Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44286",
    		name: "Quality Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44287",
    		name: "Great Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44288",
    		name: "Amazing Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44289",
    		name: "Astounding Cloth Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44301",
    		name: "Great Helm of the Winter Court",
    		slot: "Head"
    	},
    	{
    		id: "item_44302",
    		name: "Lobe Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44303",
    		name: "Peltast Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44304",
    		name: "Orbiting Gem",
    		slot: "Head"
    	},
    	{
    		id: "item_44305",
    		name: "Insulated Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44306",
    		name: "Empusa's Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44307",
    		name: "Rohina's Mind Gem",
    		slot: "Head"
    	},
    	{
    		id: "item_44308",
    		name: "Monger's Boon",
    		slot: "Head"
    	},
    	{
    		id: "item_44309",
    		name: "Scorpiclaw Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44310",
    		name: "General Pask's Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44311",
    		name: "Cheap Goblin Helmet",
    		slot: "Head"
    	},
    	{
    		id: "item_44312",
    		name: "Pig's Disguise Kit",
    		slot: "Head"
    	},
    	{
    		id: "item_44313",
    		name: "Cow's Disguise Kit",
    		slot: "Head"
    	},
    	{
    		id: "item_44314",
    		name: "Deer's Disguise Kit",
    		slot: "Head"
    	},
    	{
    		id: "item_44315",
    		name: "Seashell Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44316",
    		name: "Fancy Seashell Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44317",
    		name: "Extra-Fancy Seashell Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44318",
    		name: "Ever-Glaring Jack O' Lantern",
    		slot: "Head"
    	},
    	{
    		id: "item_44321",
    		name: "Pig Soldier Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44322",
    		name: "Pig Horned Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44323",
    		name: "Alicorn",
    		slot: "Head"
    	},
    	{
    		id: "item_44324",
    		name: "Twee Cow Sun Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44325",
    		name: "Dark Alicorn",
    		slot: "Head"
    	},
    	{
    		id: "item_44327",
    		name: "Eveline's Comfy Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44328",
    		name: "Ratkin Revolutionist Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44329",
    		name: "Ratkin Necromancer Headdress",
    		slot: "Head"
    	},
    	{
    		id: "item_44330",
    		name: "Vagreef's Anti-Burn Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44331",
    		name: "Council Pathfinder Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44332",
    		name: "Ursula's Ri-Shin Gift",
    		slot: "Head"
    	},
    	{
    		id: "item_44333",
    		name: "Winter Court Battle-Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44334",
    		name: "Winter Court Murder-Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44335",
    		name: "Soulworm-Bitten Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44336",
    		name: "Mollusc Millinery",
    		slot: "Head"
    	},
    	{
    		id: "item_44337",
    		name: "Greenberg's Horn",
    		slot: "Head"
    	},
    	{
    		id: "item_44338",
    		name: "Kelp Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44339",
    		name: "Tough Kelp Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44340",
    		name: "Betra's Coif",
    		slot: "Head"
    	},
    	{
    		id: "item_44341",
    		name: "Fae Navy Communicator",
    		slot: "Head"
    	},
    	{
    		id: "item_44342",
    		name: "Goblin Chief's Cap",
    		slot: "Head"
    	},
    	{
    		id: "item_44406",
    		name: "Quality Cow Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44407",
    		name: "Great Cow Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44408",
    		name: "Amazing Cow Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44426",
    		name: "Quality Pig Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44427",
    		name: "Great Pig Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44428",
    		name: "Amazing Pig Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44446",
    		name: "Quality Deer Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44447",
    		name: "Great Deer Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44448",
    		name: "Amazing Deer Porkpie Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44464",
    		name: "Decent Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44465",
    		name: "Nice Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44466",
    		name: "Quality Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44467",
    		name: "Great Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44468",
    		name: "Amazing Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44469",
    		name: "Astounding Winter Hood",
    		slot: "Head"
    	},
    	{
    		id: "item_44480",
    		name: "Shoddy Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44481",
    		name: "Shoddy Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44482",
    		name: "Rough Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44483",
    		name: "Crude Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44484",
    		name: "Decent Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44485",
    		name: "Nice Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44486",
    		name: "Great Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44487",
    		name: "Amazing Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44488",
    		name: "Astounding Familiar Controller",
    		slot: "Head"
    	},
    	{
    		id: "item_44501",
    		name: "Orcish Military Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44502",
    		name: "Snowblood Misery Trooper Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44503",
    		name: "Orcish Magic Trooper Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44504",
    		name: "Veil of Twighlight Pain",
    		slot: "Head"
    	},
    	{
    		id: "item_44505",
    		name: "Death Trooper Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44506",
    		name: "Misery Trooper Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44507",
    		name: "Treachery Trooper Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44508",
    		name: "Gazluk Officer Helm",
    		slot: "Head"
    	},
    	{
    		id: "item_44509",
    		name: "War-Wizard Officer Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44510",
    		name: "Mutterer Necromancer Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44511",
    		name: "Mutterer Cabalist Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44513",
    		name: "Rough Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44514",
    		name: "Crude Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44515",
    		name: "Decent Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44516",
    		name: "Nice Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44517",
    		name: "Great Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44518",
    		name: "Amazing Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44519",
    		name: "Superb Ri-Shin Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44522",
    		name: "Decent Vol-Mu Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44523",
    		name: "Nice Vol-Mu Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44524",
    		name: "Great Vol-Mu Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44525",
    		name: "Amazing Vol-Mu Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44526",
    		name: "Superb Vol-Mu Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44531",
    		name: "Red Wing Crown (L40)",
    		slot: "Head"
    	},
    	{
    		id: "item_44532",
    		name: "Red Wing Crown (L50)",
    		slot: "Head"
    	},
    	{
    		id: "item_44533",
    		name: "Red Wing Crown (L60)",
    		slot: "Head"
    	},
    	{
    		id: "item_44534",
    		name: "Red Wing Crown (L70)",
    		slot: "Head"
    	},
    	{
    		id: "item_44535",
    		name: "Wind Crawler's Webs",
    		slot: "Head"
    	},
    	{
    		id: "item_44536",
    		name: "Red Wing Crown (L80)",
    		slot: "Head"
    	},
    	{
    		id: "item_44537",
    		name: "Milton's Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44601",
    		name: "Decent Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44602",
    		name: "Nice Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44603",
    		name: "Quality Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44604",
    		name: "Great Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44605",
    		name: "Amazing Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44606",
    		name: "Astounding Nimble Cowl",
    		slot: "Head"
    	},
    	{
    		id: "item_44621",
    		name: "Rough Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44622",
    		name: "Crude Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44623",
    		name: "Decent Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44624",
    		name: "Nice Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44625",
    		name: "Quality Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44626",
    		name: "Great Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44627",
    		name: "Amazing Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44628",
    		name: "Astounding Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44644",
    		name: "Nice Fiery Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44645",
    		name: "Quality Fiery Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44646",
    		name: "Great Fiery Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44647",
    		name: "Amazing Fiery Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44648",
    		name: "Astounding Fiery Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44664",
    		name: "Nice Forest Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44665",
    		name: "Quality Forest Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44666",
    		name: "Great Forest Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44667",
    		name: "Amazing Forest Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44668",
    		name: "Astounding Forest Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44684",
    		name: "Nice Frigid Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44685",
    		name: "Quality Frigid Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44686",
    		name: "Great Frigid Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44687",
    		name: "Amazing Frigid Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44688",
    		name: "Astounding Frigid Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44704",
    		name: "Nice Shocking Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44705",
    		name: "Quality Shocking Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44706",
    		name: "Great Shocking Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44707",
    		name: "Amazing Shocking Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44708",
    		name: "Astounding Shocking Masquerade Mask",
    		slot: "Head"
    	},
    	{
    		id: "item_44723",
    		name: "Decent Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44724",
    		name: "Nice Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44725",
    		name: "Quality Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44726",
    		name: "Great Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44727",
    		name: "Amazing Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44728",
    		name: "Astounding Bat Witch Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44741",
    		name: "Quality Ri-Shin Priest Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44742",
    		name: "Great Ri-Shin Priest Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44743",
    		name: "Amazing Ri-Shin Priest Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_44744",
    		name: "Astounding Ri-Shin Priest Hat",
    		slot: "Head"
    	},
    	{
    		id: "item_45001",
    		name: "Moldy Ancient Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45002",
    		name: "Basic Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45003",
    		name: "Battle-Hardened Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45004",
    		name: "Marna's Lucky Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45005",
    		name: "Sturdy Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45006",
    		name: "Goblin Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45007",
    		name: "Goblin Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45010",
    		name: "Quality Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45011",
    		name: "Snail Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45012",
    		name: "Defender of the Frail",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45013",
    		name: "Nameless Guardian's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45014",
    		name: "Quality Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45015",
    		name: "Oaken Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45016",
    		name: "Acid-Pitted Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45017",
    		name: "Tyler's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45018",
    		name: "Tyler's Second-Favorite Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45019",
    		name: "Orcish Targe",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45020",
    		name: "Elven Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45021",
    		name: "Dwarven Targe",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45022",
    		name: "Nelson Ballard's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45023",
    		name: "Basic Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45024",
    		name: "Sturdy Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45025",
    		name: "Old Crusty's Backside",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45026",
    		name: "Stalwart Targe",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45027",
    		name: "Ravana Soldier Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45028",
    		name: "Yeti Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45029",
    		name: "Basic Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45030",
    		name: "Thentree Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45031",
    		name: "Admin Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45032",
    		name: "Peltast Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45033",
    		name: "Leader's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45034",
    		name: "Cheap Goblin Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45035",
    		name: "Winter Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45036",
    		name: "Orcish Military Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45037",
    		name: "Snowblood Misery Trooper Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45038",
    		name: "Hypnotic Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45039",
    		name: "Gazluk Trooper Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45040",
    		name: "Torgan's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45041",
    		name: "Ratkin Revolutionist Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45042",
    		name: "Dream-Keeper's Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45043",
    		name: "Finesse Targe",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45044",
    		name: "Shield of the Sea",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45045",
    		name: "Fancy Shield of the Sea",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45046",
    		name: "Extra-Fancy Shield of the Sea",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45047",
    		name: "Simple Ice Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45048",
    		name: "Thick Ice Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45049",
    		name: "Fae Navy Shield",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45511",
    		name: "Basic Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45512",
    		name: "Basic Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45521",
    		name: "Rusty Knife",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45531",
    		name: "Sturdy Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45532",
    		name: "Sturdy Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45533",
    		name: "Cold-Iron Knife",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45541",
    		name: "Lovelorn Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45551",
    		name: "Quality Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45552",
    		name: "Quality Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45553",
    		name: "Goblin Lifekeeper",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45554",
    		name: "Dwarven Gouger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45561",
    		name: "Backup Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45562",
    		name: "Carving Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45571",
    		name: "Soldier's Pugeo",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45573",
    		name: "Freezing Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45581",
    		name: "Venomizer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45582",
    		name: "Stalwart Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45591",
    		name: "Elven Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45592",
    		name: "Controller's Stiletto",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45601",
    		name: "Scorpion's Revenge",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45602",
    		name: "Ravana Soldier Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45621",
    		name: "Mutterer's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45622",
    		name: "Sirine's Ivory Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45623",
    		name: "Military Khopis",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45624",
    		name: "Executrix Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45625",
    		name: "Courtesan's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45626",
    		name: "Gut-Ache's Chopper",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45627",
    		name: "Torgan's Stiletto",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45628",
    		name: "Rick's Sticker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45629",
    		name: "Ratkin Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45630",
    		name: "Fairy Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45631",
    		name: "Ranalon Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45632",
    		name: "Tough Ranalon Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45633",
    		name: "Fancy Ranalon Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45634",
    		name: "Extra-Fancy Ranalon Dagger",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45635",
    		name: "Goblin Lifekeeper",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45637",
    		name: "Autofreeze Knife",
    		slot: "MainHand"
    	},
    	{
    		id: "item_45701",
    		name: "Basic Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45702",
    		name: "Basic Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45703",
    		name: "Rusty Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45704",
    		name: "Sturdy Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45705",
    		name: "Sturdy Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45706",
    		name: "Goblin Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45707",
    		name: "Quality Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45708",
    		name: "Quality Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45709",
    		name: "Dwarven Maintenance Blade",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45710",
    		name: "Heavy Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45712",
    		name: "Elven Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45713",
    		name: "Stabmaster",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45714",
    		name: "Safety Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45715",
    		name: "Bleeder Shiv",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45716",
    		name: "Corrupted Blade",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45717",
    		name: "Timeless Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45718",
    		name: "Ratkin Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45719",
    		name: "Fairy Dirk",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45720",
    		name: "Dwarven Maintenance Blade",
    		slot: "OffHand"
    	},
    	{
    		id: "item_45721",
    		name: "Autofreeze Shiv",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46001",
    		name: "Moldy Ancient Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46002",
    		name: "Basic Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46003",
    		name: "Battle-Hardened Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46004",
    		name: "Sturdy Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46005",
    		name: "Joeh's Old Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46006",
    		name: "Quality Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46007",
    		name: "Goblinblade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46008",
    		name: "Naturebane",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46009",
    		name: "Admin Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46010",
    		name: "Blackened Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46011",
    		name: "Wolfbite",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46012",
    		name: "Simple Silver Knife",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46013",
    		name: "Silvered Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46014",
    		name: "Xiphos",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46015",
    		name: "Basic Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46016",
    		name: "Quality Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46017",
    		name: "Acid-Addled Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46018",
    		name: "Elven Longsword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46019",
    		name: "Ancient Dwarven Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46020",
    		name: "Sedgewick's Honor",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46021",
    		name: "Sturdy Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46022",
    		name: "Goblin Cutlass",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46023",
    		name: "Rusty Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46024",
    		name: "Council Trooper Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46025",
    		name: "Antique Spatha",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46026",
    		name: "Pig Sticker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46027",
    		name: "Battle-Hardened Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46028",
    		name: "Gouging Stiletto",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46029",
    		name: "Blackened Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46030",
    		name: "Janet Lew's Old Longsword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46031",
    		name: "Lord ErDrick's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46032",
    		name: "Orcish Spatha",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46033",
    		name: "Fiendish Rapier",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46034",
    		name: "Chopping Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46035",
    		name: "Blocking Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46036",
    		name: "Flaming Gazluk Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46037",
    		name: "Torgan's Spatha",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46038",
    		name: "Aktaari Cutlass",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46039",
    		name: "Ratkin Revolutionist Sword",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46040",
    		name: "Lordling's Spatha",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46041",
    		name: "Bendith's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46042",
    		name: "Shellmaster's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46043",
    		name: "Fancy Shellmaster's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46044",
    		name: "Extra-Fancy Shellmaster's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46045",
    		name: "Murdebok's Blade",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46046",
    		name: "Fae Rapier",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46501",
    		name: "Basic Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46502",
    		name: "Basic Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46503",
    		name: "Sturdy Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46504",
    		name: "Sturdy Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46505",
    		name: "Moldy Trancelute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46506",
    		name: "Jolly Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46507",
    		name: "Quality Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46508",
    		name: "Quality Bard Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46509",
    		name: "Goblin Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46510",
    		name: "Trancelute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46511",
    		name: "Refurbished Doomlute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46512",
    		name: "Leader's Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46513",
    		name: "Rakshasa Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46514",
    		name: "Starlute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46515",
    		name: "Withering Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46516",
    		name: "Doomlute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46517",
    		name: "Daisy",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46518",
    		name: "Fairy Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_46701",
    		name: "Basic Bard Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46702",
    		name: "Blowing Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46703",
    		name: "War Shofar",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46704",
    		name: "Blast Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46705",
    		name: "Quality Ocarina",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46706",
    		name: "Quality Ocarina",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46707",
    		name: "Stickhorn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46708",
    		name: "Stonebugle",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46709",
    		name: "Death Lur",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46710",
    		name: "Leader's Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46711",
    		name: "Oakhorn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46712",
    		name: "Weaver's Ocarina",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46713",
    		name: "Echo Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46714",
    		name: "Infallible Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46715",
    		name: "War Ocarina",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46716",
    		name: "Destiny Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46717",
    		name: "Conch of the Thirtieth Land",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46718",
    		name: "Quality Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46734",
    		name: "Decent Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46735",
    		name: "Nice Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46736",
    		name: "Quality Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46737",
    		name: "Great Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46738",
    		name: "Amazing Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_46739",
    		name: "Astounding Musical Conch",
    		slot: "OffHand"
    	},
    	{
    		id: "item_47001",
    		name: "Moldy Ancient Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47002",
    		name: "Basic Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47003",
    		name: "Battle Hardened Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47004",
    		name: "Sturdy Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47005",
    		name: "Velkort's Hand-Me-Down",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47006",
    		name: "Quality Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47007",
    		name: "Inquisitor's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47008",
    		name: "Fatestick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47009",
    		name: "Swishystick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47010",
    		name: "Balanced Battlestaff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47011",
    		name: "Hogan's Crippler",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47012",
    		name: "The Galvanizer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47013",
    		name: "Jesina's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47014",
    		name: "Basic Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47015",
    		name: "Goblin Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47016",
    		name: "Necromancer's Training Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47017",
    		name: "Necromancy Test Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47018",
    		name: "Elven Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47019",
    		name: "Elerimon Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47020",
    		name: "Yagreet's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47021",
    		name: "Yagreet's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47022",
    		name: "Druidic Training Stick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47023",
    		name: "Bonfire Summoner",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47024",
    		name: "Sturdy Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47025",
    		name: "Quality Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47026",
    		name: "Orloaka's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47027",
    		name: "Dwarven Medic Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47028",
    		name: "Freezing Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47029",
    		name: "Staff of Ice",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47030",
    		name: "Sandy Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47031",
    		name: "Adequate Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47032",
    		name: "Druidic Assault Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47033",
    		name: "Battle Hardened Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47034",
    		name: "Battle Hardened Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47035",
    		name: "Sun Warden",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47036",
    		name: "Roshun's Heavy Hitter",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47037",
    		name: "Winged Witch Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47038",
    		name: "Lunging Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47039",
    		name: "Hippogriff Prod",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47040",
    		name: "Tactician's Halberd",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47041",
    		name: "Torgan's Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47042",
    		name: "Guardian Trident",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47043",
    		name: "Ranastaff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47044",
    		name: "Ratkin Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47045",
    		name: "Trueoak Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47046",
    		name: "Staff of the Sea",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47047",
    		name: "Fancy Staff of the Sea",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47048",
    		name: "Extra-Fancy Staff of the Sea",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47050",
    		name: "Tough Ranastaff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47051",
    		name: "Sacred Guardian Trident",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47052",
    		name: "Lusssha's Trident",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47101",
    		name: "Shoddy Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47102",
    		name: "Rough Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47103",
    		name: "Crude Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47104",
    		name: "Decent Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47105",
    		name: "Nice Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47106",
    		name: "Quality Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47107",
    		name: "Great Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47108",
    		name: "Amazing Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47109",
    		name: "Astounding Melee Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47121",
    		name: "Shoddy Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47122",
    		name: "Rough Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47123",
    		name: "Crude Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47124",
    		name: "Decent Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47125",
    		name: "Nice Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47126",
    		name: "Quality Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47127",
    		name: "Great Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47128",
    		name: "Amazing Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47129",
    		name: "Astounding Combat Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47141",
    		name: "Shoddy Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47142",
    		name: "Rough Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47143",
    		name: "Crude Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47144",
    		name: "Decent Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47145",
    		name: "Nice Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47146",
    		name: "Quality Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47147",
    		name: "Great Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47148",
    		name: "Amazing Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47149",
    		name: "Astounding Priest Staff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47401",
    		name: "Grand Fae Wand of Cold",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47402",
    		name: "Basic Fae Wand of Cold",
    		slot: "MainHand"
    	},
    	{
    		id: "item_47403",
    		name: "Basic Fae Wand of Cold",
    		slot: "MainHand"
    	},
    	{
    		id: "item_48001",
    		name: "Amulet of Lycanthropy",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48002",
    		name: "Amulet of Competent Lycanthropy",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48003",
    		name: "Amulet of Swording",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48004",
    		name: "Amulet of Competent Swording",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48005",
    		name: "Amulet of Unarmed Fighting",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48006",
    		name: "Amulet of Competent Unarmed Fighting",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48007",
    		name: "Amulet of Fire Magic",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48008",
    		name: "Amulet of Competent Fire Magic",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48009",
    		name: "Amulet of Max Health +5",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48010",
    		name: "Amulet of Max Health +10",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48011",
    		name: "Amulet of Max Health +15",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48012",
    		name: "Amulet of Max Health +20",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48013",
    		name: "Amulet of Max Armor +5",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48014",
    		name: "Amulet of Max Armor +10",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48015",
    		name: "Amulet of Max Armor +15",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48016",
    		name: "Amulet of Max Armor +20",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48017",
    		name: "Amulet of Max Armor +25",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48018",
    		name: "Amulet of the Pack",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48019",
    		name: "Eraphylle",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48020",
    		name: "Yyllastra",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48021",
    		name: "Eynophille",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48022",
    		name: "Amulet of Crushing Mitigation 1",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48023",
    		name: "Amulet of Crushing Mitigation 2",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48024",
    		name: "Amulet of Crushing Mitigation 3",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48025",
    		name: "Amulet of Crushing Mitigation 4",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48026",
    		name: "Amulet of Crushing Mitigation 5",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48027",
    		name: "Amulet of Slashing Mitigation 1",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48028",
    		name: "Amulet of Slashing Mitigation 2",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48029",
    		name: "Amulet of Slashing Mitigation 3",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48030",
    		name: "Amulet of Slashing Mitigation 4",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48031",
    		name: "Amulet of Slashing Mitigation 5",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48032",
    		name: "Amulet of Piercing Mitigation 1",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48033",
    		name: "Amulet of Piercing Mitigation 2",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48034",
    		name: "Amulet of Piercing Mitigation 3",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48035",
    		name: "Amulet of Piercing Mitigation 4",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48036",
    		name: "Amulet of Piercing Mitigation 5",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48037",
    		name: "Amulet of Max Health +25",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48038",
    		name: "Rita's Charm",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48039",
    		name: "Sie Antry's Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48040",
    		name: "Amulet of Cold Mitigation 1",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48041",
    		name: "Elzehatl's Insignia",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48042",
    		name: "Necromancy Test Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48043",
    		name: "Tidal's Circlet",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48044",
    		name: "Amulet of Max Armor +30",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48045",
    		name: "Amulet of Max Health +30",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48046",
    		name: "Symbol of Hate Made Manifest",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48047",
    		name: "Hammerseal",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48048",
    		name: "Fae Bead Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48049",
    		name: "Goblin Necromancy Focus",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48050",
    		name: "Jumjab's Compelling Augment",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48051",
    		name: "Ulnaphylle",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48052",
    		name: "Soothing Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48053",
    		name: "Amulet of the Rugged Traveler",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48054",
    		name: "Alamyneth",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48055",
    		name: "Thundersmite",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48056",
    		name: "Amulet of Max Armor +50",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48057",
    		name: "Indicator of False Beauty",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48058",
    		name: "Cutting Blade Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48059",
    		name: "Fox Glyph",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48060",
    		name: "Hexagonal Trendsetter",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48061",
    		name: "Rhino Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48062",
    		name: "Lord Serbule's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48063",
    		name: "Claudia's Pouch",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48064",
    		name: "Ashk's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48065",
    		name: "Amulet of Max Power +30",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48066",
    		name: "Gutsaver Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48067",
    		name: "'Treatment of The Poor'",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48068",
    		name: "Jamurra Derby Ribbon",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48069",
    		name: "Tast Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48070",
    		name: "Beakhorse's Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48071",
    		name: "Gasu'um's Old Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48072",
    		name: "Gasu'um's Practice Amulet",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48073",
    		name: "Shoddy Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48074",
    		name: "Rough Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48075",
    		name: "Crude Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48076",
    		name: "Decent Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48077",
    		name: "Nice Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48078",
    		name: "Quality Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48079",
    		name: "Great Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48080",
    		name: "Amazing Harukita Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48083",
    		name: "Shoddy Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48084",
    		name: "Rough Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48085",
    		name: "Crude Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48086",
    		name: "Decent Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48087",
    		name: "Nice Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48088",
    		name: "Quality Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48089",
    		name: "Great Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48090",
    		name: "Amazing Kajich Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48093",
    		name: "Shoddy Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48094",
    		name: "Rough Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48095",
    		name: "Crude Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48096",
    		name: "Decent Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48097",
    		name: "Nice Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48098",
    		name: "Quality Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48099",
    		name: "Great Familiar Recall Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48103",
    		name: "Simple Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48104",
    		name: "Chirrra's Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48105",
    		name: "Chirrra's Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48106",
    		name: "Chirrra's Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48107",
    		name: "Chirrra's Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48121",
    		name: "Shoddy Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48122",
    		name: "Rough Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48123",
    		name: "Crude Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48124",
    		name: "Decent Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48125",
    		name: "Nice Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48126",
    		name: "Quality Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48127",
    		name: "Great Arisetsu Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48131",
    		name: "Ratkin Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48132",
    		name: "Battle Priest's Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48133",
    		name: "Amulet of Cold Protection",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48134",
    		name: "Fae Rhino Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48135",
    		name: "Amulet of Mindwalls",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48136",
    		name: "Fierce Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48137",
    		name: "Pickles' Protective Collar",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48138",
    		name: "Basic Enoyos Talisman",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48139",
    		name: "Amphibian Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48140",
    		name: "Amulet of Piercing Mitigation 4",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48141",
    		name: "Scallywag Amulet",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48145",
    		name: "Nice Enchanted Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48146",
    		name: "Quality Enchanted Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48147",
    		name: "Great Enchanted Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48148",
    		name: "Amazing Enchanted Necklace",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48155",
    		name: "Nice Battle-Priest's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48156",
    		name: "Quality Battle-Priest's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48157",
    		name: "Great Battle-Priest's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48158",
    		name: "Amazing Battle-Priest's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48165",
    		name: "Nice Darkness Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48166",
    		name: "Quality Darkness Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48167",
    		name: "Great Darkness Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48168",
    		name: "Amazing Darkness Medallion",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48180",
    		name: "Enhanced Amulet of the Rugged Traveler",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48181",
    		name: "Pennoc's Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_48182",
    		name: "Pennoc's Pendulous Pendant",
    		slot: "Necklace"
    	},
    	{
    		id: "item_49001",
    		name: "Ring of Strong Ankles",
    		slot: "Ring"
    	},
    	{
    		id: "item_49002",
    		name: "Ring of Jaunty Traipsing",
    		slot: "Ring"
    	},
    	{
    		id: "item_49003",
    		name: "Ring of Vague Poison Resistance",
    		slot: "Ring"
    	},
    	{
    		id: "item_49004",
    		name: "Ring of Telepathic Pestering",
    		slot: "Ring"
    	},
    	{
    		id: "item_49005",
    		name: "Ring of Trusty Punching",
    		slot: "Ring"
    	},
    	{
    		id: "item_49006",
    		name: "Ring of Snakelike Behavior",
    		slot: "Ring"
    	},
    	{
    		id: "item_49007",
    		name: "Ring of Multiple Lacerations",
    		slot: "Ring"
    	},
    	{
    		id: "item_49008",
    		name: "Ring of Booming",
    		slot: "Ring"
    	},
    	{
    		id: "item_49009",
    		name: "Ring of Gusty Striking",
    		slot: "Ring"
    	},
    	{
    		id: "item_49010",
    		name: "Ring of Psychiatric Abuse",
    		slot: "Ring"
    	},
    	{
    		id: "item_49011",
    		name: "Ring of Furry Clawing",
    		slot: "Ring"
    	},
    	{
    		id: "item_49021",
    		name: "Ring of Kicking Ass",
    		slot: "Ring"
    	},
    	{
    		id: "item_49022",
    		name: "Ring of Armor Regeneration +5",
    		slot: "Ring"
    	},
    	{
    		id: "item_49023",
    		name: "Ring of Staff Supremacy",
    		slot: "Ring"
    	},
    	{
    		id: "item_49024",
    		name: "Ring of Critical Hits",
    		slot: "Ring"
    	},
    	{
    		id: "item_49025",
    		name: "Ring of Natural Hurting",
    		slot: "Ring"
    	},
    	{
    		id: "item_49026",
    		name: "Ring of Acid Resistance",
    		slot: "Ring"
    	},
    	{
    		id: "item_49027",
    		name: "Ring of Dark Despair",
    		slot: "Ring"
    	},
    	{
    		id: "item_49028",
    		name: "Grand Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49029",
    		name: "Ring of Arrows",
    		slot: "Ring"
    	},
    	{
    		id: "item_49030",
    		name: "Ring of Ferocious Clawing",
    		slot: "Ring"
    	},
    	{
    		id: "item_49031",
    		name: "Tyler's Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49032",
    		name: "Ring of Practical Psychology",
    		slot: "Ring"
    	},
    	{
    		id: "item_49033",
    		name: "Admin Ring of Non-Detection",
    		slot: "Ring"
    	},
    	{
    		id: "item_49034",
    		name: "Ring of Burning",
    		slot: "Ring"
    	},
    	{
    		id: "item_49035",
    		name: "Ring of Health",
    		slot: "Ring"
    	},
    	{
    		id: "item_49036",
    		name: "Stafflord's Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49037",
    		name: "Ring of Directness",
    		slot: "Ring"
    	},
    	{
    		id: "item_49038",
    		name: "Ring of Acid Blasting",
    		slot: "Ring"
    	},
    	{
    		id: "item_49039",
    		name: "Ring of Wolfen Terror",
    		slot: "Ring"
    	},
    	{
    		id: "item_49040",
    		name: "Ring of Swording",
    		slot: "Ring"
    	},
    	{
    		id: "item_49041",
    		name: "Ring of Mindblasts",
    		slot: "Ring"
    	},
    	{
    		id: "item_49042",
    		name: "Arcane Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49043",
    		name: "Dwarven Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49044",
    		name: "Mindroot",
    		slot: "Ring"
    	},
    	{
    		id: "item_49045",
    		name: "Ring of Increasing Anxiety",
    		slot: "Ring"
    	},
    	{
    		id: "item_49046",
    		name: "Ring of Projectile Expression",
    		slot: "Ring"
    	},
    	{
    		id: "item_49047",
    		name: "Heavy Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49048",
    		name: "Blight Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49049",
    		name: "Ring of Mind Insight",
    		slot: "Ring"
    	},
    	{
    		id: "item_49050",
    		name: "Gaudy Ring of Sleaziness",
    		slot: "Ring"
    	},
    	{
    		id: "item_49051",
    		name: "Fae Ring of Healing",
    		slot: "Ring"
    	},
    	{
    		id: "item_49052",
    		name: "Aquamarine Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49053",
    		name: "Chargeman's Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49054",
    		name: "Ring of Toxin Archery",
    		slot: "Ring"
    	},
    	{
    		id: "item_49055",
    		name: "Ring of Snow",
    		slot: "Ring"
    	},
    	{
    		id: "item_49056",
    		name: "Ring of Elemental Resistance",
    		slot: "Ring"
    	},
    	{
    		id: "item_49057",
    		name: "Gazluk Officer's Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49058",
    		name: "Zukelmux's Insignia Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49059",
    		name: "Slime Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49060",
    		name: "Gasu'um's Old Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49061",
    		name: "Bellema's Old Pledge Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49062",
    		name: "Shoddy Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49063",
    		name: "Rough Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49064",
    		name: "Crude Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49065",
    		name: "Decent Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49066",
    		name: "Nice Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49067",
    		name: "Quality Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49068",
    		name: "Great Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49069",
    		name: "Amazing Ilth Hale Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49101",
    		name: "Scrounger's Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49102",
    		name: "Ring of Wiggling",
    		slot: "Ring"
    	},
    	{
    		id: "item_49103",
    		name: "Ratty Tactics Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49104",
    		name: "Ring of Basic Reconnaissance",
    		slot: "Ring"
    	},
    	{
    		id: "item_49105",
    		name: "Ring of the Slashing Beast",
    		slot: "Ring"
    	},
    	{
    		id: "item_49106",
    		name: "Classic Warden Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49107",
    		name: "Warden Winter Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49108",
    		name: "Frog Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49109",
    		name: "Ring of Accuracy",
    		slot: "Ring"
    	},
    	{
    		id: "item_49110",
    		name: "Ring of Sudden Doom",
    		slot: "Ring"
    	},
    	{
    		id: "item_49111",
    		name: "Ring of Accuracy",
    		slot: "Ring"
    	},
    	{
    		id: "item_49112",
    		name: "Ring of Biteforce Pressure",
    		slot: "Ring"
    	},
    	{
    		id: "item_49113",
    		name: "Shielding Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49114",
    		name: "Position Inferencing Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49115",
    		name: "Nice Magic Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49116",
    		name: "Quality Magic Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49117",
    		name: "Great Magic Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49118",
    		name: "Amazing Magic Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49125",
    		name: "Nice Winter Fae Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49126",
    		name: "Quality Winter Fae Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49127",
    		name: "Great Winter Fae Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_49128",
    		name: "Amazing Winter Fae Ring",
    		slot: "Ring"
    	},
    	{
    		id: "item_50001",
    		name: "Tail Ring of Righteousness",
    		slot: "Racial"
    	},
    	{
    		id: "item_50002",
    		name: "Sinda's Tail Ring of Cartography",
    		slot: "Racial"
    	},
    	{
    		id: "item_50003",
    		name: "Earrings of Community",
    		slot: "Racial"
    	},
    	{
    		id: "item_50004",
    		name: "Navel Ring of Cleanliness",
    		slot: "Racial"
    	},
    	{
    		id: "item_50005",
    		name: "Navel Ring of Health",
    		slot: "Racial"
    	},
    	{
    		id: "item_50006",
    		name: "Navel Ring of Precision",
    		slot: "Racial"
    	},
    	{
    		id: "item_50007",
    		name: "Tail Ring of Hydration",
    		slot: "Racial"
    	},
    	{
    		id: "item_50008",
    		name: "Nose Ring of Inexhaustability",
    		slot: "Racial"
    	},
    	{
    		id: "item_50009",
    		name: "Bonnie's Earrings",
    		slot: "Racial"
    	},
    	{
    		id: "item_50010",
    		name: "Admin Test Earrings",
    		slot: "Racial"
    	},
    	{
    		id: "item_50011",
    		name: "Tail Ring of Defiance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50012",
    		name: "Nose Ring of The Seductive Cow",
    		slot: "Racial"
    	},
    	{
    		id: "item_50013",
    		name: "White-Tail Ring",
    		slot: "Racial"
    	},
    	{
    		id: "item_50014",
    		name: "Black-Tail Ring",
    		slot: "Racial"
    	},
    	{
    		id: "item_50015",
    		name: "Nose Ring of Destructive Tendencies",
    		slot: "Racial"
    	},
    	{
    		id: "item_50016",
    		name: "Ashk's Tail-Ring of Remembrance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50017",
    		name: "Earrings of Protection",
    		slot: "Racial"
    	},
    	{
    		id: "item_50018",
    		name: "Rattail-Ring of Screeching",
    		slot: "Racial"
    	},
    	{
    		id: "item_50019",
    		name: "Rattail-Ring of Digestion",
    		slot: "Racial"
    	},
    	{
    		id: "item_50020",
    		name: "Nose Ring of Foulness Protection",
    		slot: "Racial"
    	},
    	{
    		id: "item_50021",
    		name: "Ursula's Earrings",
    		slot: "Racial"
    	},
    	{
    		id: "item_50022",
    		name: "Wing Tassels of Beefriending",
    		slot: "Racial"
    	},
    	{
    		id: "item_50023",
    		name: "Wing Rings of Fae Energy",
    		slot: "Racial"
    	},
    	{
    		id: "item_50024",
    		name: "Wing Tassels of Swift Wings",
    		slot: "Racial"
    	},
    	{
    		id: "item_50025",
    		name: "Foxtail Ring of Pouncing",
    		slot: "Racial"
    	},
    	{
    		id: "item_50026",
    		name: "Foxtail Ring of Flow",
    		slot: "Racial"
    	},
    	{
    		id: "item_50101",
    		name: "Earrings of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50102",
    		name: "Navel Ring of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50103",
    		name: "Tail Ring of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50104",
    		name: "Nose Ring of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50105",
    		name: "Wing Rings of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_50106",
    		name: "Mandible Dye of Glowy Crystal Resistance",
    		slot: "Racial"
    	},
    	{
    		id: "item_51001",
    		name: "Basic Combat Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51002",
    		name: "Hogan's Flingin' Stick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51003",
    		name: "Beaker-Stick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51004",
    		name: "Acid Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51005",
    		name: "Splash Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51006",
    		name: "Recuperative Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51007",
    		name: "Beaker of Xegatis",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51008",
    		name: "Maiming Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51009",
    		name: "Chugging Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51010",
    		name: "Basic Combat Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51011",
    		name: "Basic Combat Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51012",
    		name: "Acid Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51013",
    		name: "Splash Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51014",
    		name: "Recuperative Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51015",
    		name: "War Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51016",
    		name: "Chugging Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51017",
    		name: "Basic Combat Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51018",
    		name: "Dwarven Brewer Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51019",
    		name: "Dwarf-Inspired Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51020",
    		name: "Bombing Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51021",
    		name: "Lopsided Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51022",
    		name: "Anhinda's Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51023",
    		name: "Spillproof Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51024",
    		name: "Serpent Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51025",
    		name: "Flask of Chills",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51026",
    		name: "Rathla's Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51027",
    		name: "Crimson Flask",
    		slot: "OffHand"
    	},
    	{
    		id: "item_51061",
    		name: "Fish Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51062",
    		name: "Multipurpose Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51063",
    		name: "Tricky Sage Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51064",
    		name: "Tolmar's Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51065",
    		name: "Jar of Explosions",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51066",
    		name: "Tamoko's Beaker",
    		slot: "MainHand"
    	},
    	{
    		id: "item_51067",
    		name: "Beaker of Formless Toxin",
    		slot: "MainHand"
    	},
    	{
    		id: "item_52001",
    		name: "Old Worn Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52002",
    		name: "Stock Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52003",
    		name: "Hunting Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52004",
    		name: "Goblinized Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52005",
    		name: "Un-Tal Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52006",
    		name: "Basic Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52007",
    		name: "Lawara's Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52008",
    		name: "Tremor's Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52009",
    		name: "Elven Master Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52010",
    		name: "Dwarven Bashbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52011",
    		name: "Eltibule Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52012",
    		name: "Goblinic Piercer",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52013",
    		name: "Tremor's Enhanced Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52014",
    		name: "Stalwart Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52015",
    		name: "Malgath's Demo Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52016",
    		name: "Bow of Range",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52017",
    		name: "Fastbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52018",
    		name: "Replica Rakshasa Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52019",
    		name: "Thentree Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52020",
    		name: "Blackened Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52021",
    		name: "Peltast Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52022",
    		name: "Cheap Goblinized Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52023",
    		name: "Orcish Military Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52024",
    		name: "Shockbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52025",
    		name: "Prescient Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52026",
    		name: "Fangblade Jr.",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52027",
    		name: "Fairy Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52028",
    		name: "Floxie's Faebow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52029",
    		name: "Quality Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52030",
    		name: "Faebow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52031",
    		name: "Overgoblinized Bow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52601",
    		name: "Practice Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52602",
    		name: "Stock Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52603",
    		name: "Stock Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52604",
    		name: "Cutting Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52605",
    		name: "Dark Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52606",
    		name: "Speed Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52607",
    		name: "Crossbow of Flames",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52608",
    		name: "Demonic Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52609",
    		name: "Hunting Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52610",
    		name: "Double Crossbow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_52611",
    		name: "Darkcaster",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53001",
    		name: "Shoddy Brass Knuckles",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53002",
    		name: "Corroded Brass Knuckles",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53003",
    		name: "Basic Brass Knuckles",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53004",
    		name: "Protruding Knuckles",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53005",
    		name: "Sturdy Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53006",
    		name: "Goblin Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53007",
    		name: "Quality Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53008",
    		name: "Quality Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53009",
    		name: "Orcish Katar",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53011",
    		name: "Fist of the Green Man",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53012",
    		name: "Spider Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53013",
    		name: "Elven Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53014",
    		name: "Dwarven Pugilfist",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53015",
    		name: "Golem Fist",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53016",
    		name: "Serpent Sting",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53017",
    		name: "Yeti Knuckleduster",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53018",
    		name: "Glasstone Fist",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53019",
    		name: "Slicing Katar",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53020",
    		name: "Pounding Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53021",
    		name: "Mutterer's Katar",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53022",
    		name: "War Golem Fist",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53023",
    		name: "Torgan's Katar",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53024",
    		name: "Ratkin Katar",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53025",
    		name: "Fairy Cestus",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53026",
    		name: "Frog Punch",
    		slot: "MainHand"
    	},
    	{
    		id: "item_53501",
    		name: "Shoddy Fighting Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53502",
    		name: "Primitive Fighting Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53503",
    		name: "Goblin Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53504",
    		name: "Sturdy Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53505",
    		name: "Quality Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53506",
    		name: "Quality Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53507",
    		name: "Furlak's Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53508",
    		name: "Basic War Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53509",
    		name: "Sand War Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53510",
    		name: "Fae Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53512",
    		name: "Stalwart Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53513",
    		name: "Resistant Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53514",
    		name: "Torturer's Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53515",
    		name: "Claw-Barrager",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53516",
    		name: "Ridiculer's Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53517",
    		name: "Tragic Kitten Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53518",
    		name: "Running Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53519",
    		name: "Torgan's Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53520",
    		name: "Ratkin Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_53521",
    		name: "Troll Claw",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54001",
    		name: "Classic Lute",
    		slot: "MainHand"
    	},
    	{
    		id: "item_54002",
    		name: "Hand Drum",
    		slot: "MainHand"
    	},
    	{
    		id: "item_54003",
    		name: "Gemshorn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54004",
    		name: "Blatterhorn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54005",
    		name: "Mini-Dulcimer",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54006",
    		name: "Harp",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54007",
    		name: "Fog Horn",
    		slot: "OffHand"
    	},
    	{
    		id: "item_54008",
    		name: "Fairy Chimes",
    		slot: "MainHand"
    	},
    	{
    		id: "item_54101",
    		name: "Belt of The Bovine Battler",
    		slot: "Waist"
    	},
    	{
    		id: "item_54102",
    		name: "Belt of The Porcine Warrior",
    		slot: "Waist"
    	},
    	{
    		id: "item_54103",
    		name: "Belt of The Forest King",
    		slot: "Waist"
    	},
    	{
    		id: "item_54104",
    		name: "Belt of The Arachnid",
    		slot: "Waist"
    	},
    	{
    		id: "item_54105",
    		name: "Belt of the Swordsman",
    		slot: "Waist"
    	},
    	{
    		id: "item_54106",
    		name: "Belt of the Psychologist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54107",
    		name: "Belt of the Shielder",
    		slot: "Waist"
    	},
    	{
    		id: "item_54108",
    		name: "Belt of the Unarmed Fighter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54109",
    		name: "Belt of the Fire Mage",
    		slot: "Waist"
    	},
    	{
    		id: "item_54110",
    		name: "Belt of the Battle Chemist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54111",
    		name: "Belt of the Mentalist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54112",
    		name: "Belt of the Archer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54113",
    		name: "Belt of the Animal Handler",
    		slot: "Waist"
    	},
    	{
    		id: "item_54114",
    		name: "Belt of the Staff Fighter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54115",
    		name: "Belt of the Werewolf",
    		slot: "Waist"
    	},
    	{
    		id: "item_54116",
    		name: "Belt of the Necromancer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54117",
    		name: "Belt of the Hammerer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54118",
    		name: "Belt of the Druid",
    		slot: "Waist"
    	},
    	{
    		id: "item_54119",
    		name: "Echur's Belt of the Mentalist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54120",
    		name: "Belt of the Ice Mage",
    		slot: "Waist"
    	},
    	{
    		id: "item_54121",
    		name: "Belt of the Batty Battler",
    		slot: "Waist"
    	},
    	{
    		id: "item_54122",
    		name: "Belt of the Knife Fighter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54123",
    		name: "Belt of the Brave Rabbit",
    		slot: "Waist"
    	},
    	{
    		id: "item_54124",
    		name: "Belt of the Priest",
    		slot: "Waist"
    	},
    	{
    		id: "item_54125",
    		name: "Belt of the Bard",
    		slot: "Waist"
    	},
    	{
    		id: "item_54126",
    		name: "Belt of the Warden",
    		slot: "Waist"
    	},
    	{
    		id: "item_54127",
    		name: "Belt of the Spirit Fox",
    		slot: "Waist"
    	},
    	{
    		id: "item_54201",
    		name: "Belt of The Soldier",
    		slot: "Waist"
    	},
    	{
    		id: "item_54202",
    		name: "Belt of The Gladiator",
    		slot: "Waist"
    	},
    	{
    		id: "item_54203",
    		name: "Belt of The Medic",
    		slot: "Waist"
    	},
    	{
    		id: "item_54204",
    		name: "Belt of The Monk",
    		slot: "Waist"
    	},
    	{
    		id: "item_54205",
    		name: "Belt of The War Wizard",
    		slot: "Waist"
    	},
    	{
    		id: "item_54206",
    		name: "Belt of The Sneak",
    		slot: "Waist"
    	},
    	{
    		id: "item_54207",
    		name: "Belt of The Alchemist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54208",
    		name: "Belt of The Ranger",
    		slot: "Waist"
    	},
    	{
    		id: "item_54209",
    		name: "Belt of The Defender",
    		slot: "Waist"
    	},
    	{
    		id: "item_54210",
    		name: "Belt of The Defiler",
    		slot: "Waist"
    	},
    	{
    		id: "item_54211",
    		name: "Belt of The Vile General",
    		slot: "Waist"
    	},
    	{
    		id: "item_54212",
    		name: "Belt of The Support Archer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54213",
    		name: "Belt of The Pack Leader",
    		slot: "Waist"
    	},
    	{
    		id: "item_54214",
    		name: "Belt of The Cunning Wolf",
    		slot: "Waist"
    	},
    	{
    		id: "item_54215",
    		name: "Belt of The Hunter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54216",
    		name: "Belt of The Wandering Do-Gooder",
    		slot: "Waist"
    	},
    	{
    		id: "item_54217",
    		name: "Belt of The Master Exploder",
    		slot: "Waist"
    	},
    	{
    		id: "item_54218",
    		name: "Belt of The Skirmish Mage",
    		slot: "Waist"
    	},
    	{
    		id: "item_54219",
    		name: "Belt of The Wraith",
    		slot: "Waist"
    	},
    	{
    		id: "item_54220",
    		name: "Belt of The Feral Intendant",
    		slot: "Waist"
    	},
    	{
    		id: "item_54221",
    		name: "Belt of The Barbarian",
    		slot: "Waist"
    	},
    	{
    		id: "item_54222",
    		name: "Belt of The Woodland Warrior",
    		slot: "Waist"
    	},
    	{
    		id: "item_54223",
    		name: "Belt of The Mindfist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54224",
    		name: "Belt of The Natural Healer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54225",
    		name: "Belt of The Controller",
    		slot: "Waist"
    	},
    	{
    		id: "item_54226",
    		name: "Belt of The Forest Traveler",
    		slot: "Waist"
    	},
    	{
    		id: "item_54227",
    		name: "Belt of The Cruel Tormenter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54228",
    		name: "Belt of The Wise Duelist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54229",
    		name: "Belt of The Temperature Mage",
    		slot: "Waist"
    	},
    	{
    		id: "item_54230",
    		name: "Belt of The Tundra Guardian",
    		slot: "Waist"
    	},
    	{
    		id: "item_54231",
    		name: "Belt of The Freeze Wizard",
    		slot: "Waist"
    	},
    	{
    		id: "item_54232",
    		name: "Belt of The Winter Warden",
    		slot: "Waist"
    	},
    	{
    		id: "item_54233",
    		name: "Belt of The Crypt Keeper",
    		slot: "Waist"
    	},
    	{
    		id: "item_54234",
    		name: "Belt of The Death Doctor",
    		slot: "Waist"
    	},
    	{
    		id: "item_54235",
    		name: "Belt of The Skirmisher",
    		slot: "Waist"
    	},
    	{
    		id: "item_54236",
    		name: "Belt of The Cunning Assailant",
    		slot: "Waist"
    	},
    	{
    		id: "item_54237",
    		name: "Belt of The Ambusher",
    		slot: "Waist"
    	},
    	{
    		id: "item_54238",
    		name: "Belt of The Chemist",
    		slot: "Waist"
    	},
    	{
    		id: "item_54239",
    		name: "Belt of The Blade Dancer",
    		slot: "Waist"
    	},
    	{
    		id: "item_54240",
    		name: "Sirine's Belt of the Hunter",
    		slot: "Waist"
    	},
    	{
    		id: "item_54301",
    		name: "Lucky Belt of Uncommon Rewards",
    		slot: "Waist"
    	},
    	{
    		id: "item_54302",
    		name: "Lucky Belt of Nice Rewards",
    		slot: "Waist"
    	},
    	{
    		id: "item_54311",
    		name: "Shoddy Pocket Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54312",
    		name: "Crude Pocket Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54313",
    		name: "Nice Pocket Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54314",
    		name: "Great Pocket Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54320",
    		name: "Beginner's Rat Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54321",
    		name: "Novice's Rat Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54323",
    		name: "Shaman's Rat Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54325",
    		name: "Shaman's Safety Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54326",
    		name: "Shock Absorbing Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54331",
    		name: "Shoddy Hardcore Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54332",
    		name: "Crude Hardcore Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54333",
    		name: "Nice Hardcore Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54334",
    		name: "Great Hardcore Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54503",
    		name: "Crude Arachnid Harness",
    		slot: "Waist"
    	},
    	{
    		id: "item_54505",
    		name: "Nice Arachnid Harness",
    		slot: "Waist"
    	},
    	{
    		id: "item_54507",
    		name: "Great Arachnid Harness",
    		slot: "Waist"
    	},
    	{
    		id: "item_54511",
    		name: "Buckle of Arisetsu",
    		slot: "Waist"
    	},
    	{
    		id: "item_54601",
    		name: "Buckle of Basic Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54602",
    		name: "Buckle of Competent Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54603",
    		name: "Buckle of Impressive Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54604",
    		name: "Buckle of Masterful Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54605",
    		name: "Buckle of Astounding Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54606",
    		name: "Buckle of Ludicrous Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54607",
    		name: "Buckle of Swift Slagging",
    		slot: "Waist"
    	},
    	{
    		id: "item_54608",
    		name: "Buckle of Hastened Slagging",
    		slot: "Waist"
    	},
    	{
    		id: "item_54609",
    		name: "Buckle of Fast Slagging",
    		slot: "Waist"
    	},
    	{
    		id: "item_54610",
    		name: "Buckle of Slagging Blurs",
    		slot: "Waist"
    	},
    	{
    		id: "item_54611",
    		name: "Buckle of Lightened Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54612",
    		name: "Buckle of Unburdened Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54613",
    		name: "Buckle of Easy Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54614",
    		name: "Buckle of Featherweight Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54615",
    		name: "Buckle of Flowing Hammering",
    		slot: "Waist"
    	},
    	{
    		id: "item_54616",
    		name: "Buckle of Healthy Hammering 1",
    		slot: "Waist"
    	},
    	{
    		id: "item_54617",
    		name: "Buckle of Healthy Hammering 2",
    		slot: "Waist"
    	},
    	{
    		id: "item_54618",
    		name: "Buckle of Healthy Hammering 3",
    		slot: "Waist"
    	},
    	{
    		id: "item_54619",
    		name: "Buckle of Healthy Hammering 4",
    		slot: "Waist"
    	},
    	{
    		id: "item_54620",
    		name: "Buckle of Healthy Hammering 5",
    		slot: "Waist"
    	},
    	{
    		id: "item_54621",
    		name: "Buckle of Healthy Hammering 6",
    		slot: "Waist"
    	},
    	{
    		id: "item_54622",
    		name: "Buckle of Healthy Hammering 7",
    		slot: "Waist"
    	},
    	{
    		id: "item_54623",
    		name: "Buckle of Healthy Hammering 8",
    		slot: "Waist"
    	},
    	{
    		id: "item_54624",
    		name: "Buckle of Healthy Hammering 9",
    		slot: "Waist"
    	},
    	{
    		id: "item_54625",
    		name: "Buckle of Healthy Hammering 10",
    		slot: "Waist"
    	},
    	{
    		id: "item_54626",
    		name: "Buckle of Healthy Hammering 11",
    		slot: "Waist"
    	},
    	{
    		id: "item_54627",
    		name: "Buckle of Healthy Hammering 12",
    		slot: "Waist"
    	},
    	{
    		id: "item_54628",
    		name: "Buckle of Healthy Hammering 13",
    		slot: "Waist"
    	},
    	{
    		id: "item_54629",
    		name: "Buckle of Hardy Combat 1",
    		slot: "Waist"
    	},
    	{
    		id: "item_54630",
    		name: "Buckle of Hardy Combat 2",
    		slot: "Waist"
    	},
    	{
    		id: "item_54631",
    		name: "Buckle of Hardy Combat 3",
    		slot: "Waist"
    	},
    	{
    		id: "item_54632",
    		name: "Buckle of Hardy Combat 4",
    		slot: "Waist"
    	},
    	{
    		id: "item_54633",
    		name: "Buckle of Hardy Combat 5",
    		slot: "Waist"
    	},
    	{
    		id: "item_54634",
    		name: "Buckle of Hardy Combat 6",
    		slot: "Waist"
    	},
    	{
    		id: "item_54635",
    		name: "Buckle of Hardy Combat 7",
    		slot: "Waist"
    	},
    	{
    		id: "item_54636",
    		name: "Buckle of Hardy Combat 8",
    		slot: "Waist"
    	},
    	{
    		id: "item_54637",
    		name: "Buckle of Hardy Combat 9",
    		slot: "Waist"
    	},
    	{
    		id: "item_54638",
    		name: "Buckle of Hardy Combat 10",
    		slot: "Waist"
    	},
    	{
    		id: "item_54639",
    		name: "Buckle of Hardy Combat 11",
    		slot: "Waist"
    	},
    	{
    		id: "item_54640",
    		name: "Buckle of Hardy Combat 12",
    		slot: "Waist"
    	},
    	{
    		id: "item_54651",
    		name: "Buckle of Confident Pounding 1",
    		slot: "Waist"
    	},
    	{
    		id: "item_54652",
    		name: "Buckle of Confident Pounding 2",
    		slot: "Waist"
    	},
    	{
    		id: "item_54653",
    		name: "Buckle of Confident Pounding 3",
    		slot: "Waist"
    	},
    	{
    		id: "item_54654",
    		name: "Buckle of Confident Pounding 4",
    		slot: "Waist"
    	},
    	{
    		id: "item_54655",
    		name: "Buckle of Confident Pounding 5",
    		slot: "Waist"
    	},
    	{
    		id: "item_54656",
    		name: "Buckle of Confident Pounding 6",
    		slot: "Waist"
    	},
    	{
    		id: "item_54657",
    		name: "Buckle of Confident Pounding 7",
    		slot: "Waist"
    	},
    	{
    		id: "item_54658",
    		name: "Buckle of Confident Pounding 8",
    		slot: "Waist"
    	},
    	{
    		id: "item_54659",
    		name: "Buckle of Confident Pounding 9",
    		slot: "Waist"
    	},
    	{
    		id: "item_54660",
    		name: "Buckle of Confident Pounding 10",
    		slot: "Waist"
    	},
    	{
    		id: "item_54671",
    		name: "Jake's Semi-Masterpiece",
    		slot: "Waist"
    	},
    	{
    		id: "item_54672",
    		name: "Jake's Eternal Buckle",
    		slot: "Waist"
    	},
    	{
    		id: "item_54681",
    		name: "Beginner's Dodging Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54682",
    		name: "Novice's Dodging Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54683",
    		name: "Shaman's Dodging Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54701",
    		name: "Ratkin Utility Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54702",
    		name: "Ratkin Poisoner's Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54703",
    		name: "Ratkin Shaman's Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54704",
    		name: "Shaman's Precision Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_54705",
    		name: "Warrior's Precision Belt",
    		slot: "Waist"
    	},
    	{
    		id: "item_55001",
    		name: "Warmth Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55002",
    		name: "Heat Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55003",
    		name: "Fire Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55004",
    		name: "Burning Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55005",
    		name: "Blazing Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55006",
    		name: "Incinerating Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55007",
    		name: "Melting Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55008",
    		name: "Scintillating Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55009",
    		name: "Blasting Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55010",
    		name: "Summer Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55101",
    		name: "Suicide Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55102",
    		name: "Revulsion Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55103",
    		name: "Anguish Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55104",
    		name: "Despair Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55105",
    		name: "Hate Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55106",
    		name: "Gulagra Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55107",
    		name: "Fury Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55108",
    		name: "Regret Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55109",
    		name: "Orb of Traumatic Deaths",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55110",
    		name: "Sadness Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55111",
    		name: "Winter Orb",
    		slot: "OffHand"
    	},
    	{
    		id: "item_55501",
    		name: "Simplistic Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55502",
    		name: "Simplistic Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55503",
    		name: "Primitive Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55504",
    		name: "Vicious Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55505",
    		name: "The Flower Child's Prodder",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55506",
    		name: "Cruel Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55507",
    		name: "Agrashab's Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55508",
    		name: "Gulagra's Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55509",
    		name: "Flame Basher",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55510",
    		name: "Deworming Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55511",
    		name: "Archcudgel",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55512",
    		name: "Heavy Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55513",
    		name: "Crushing Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55514",
    		name: "Productive Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55515",
    		name: "Otis's Gift Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55516",
    		name: "Shattering Archcudgel",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55517",
    		name: "Weighty Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55561",
    		name: "Shoddy Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55562",
    		name: "Rough Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55563",
    		name: "Crude Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55564",
    		name: "Decent Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55565",
    		name: "Nice Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55566",
    		name: "Quality Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55567",
    		name: "Great Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55568",
    		name: "Amazing Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55569",
    		name: "Astounding Club",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55601",
    		name: "Basic Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55602",
    		name: "Dwarven Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55603",
    		name: "Battle Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55604",
    		name: "Blasting Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55605",
    		name: "Hammer of the Five Truths",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55606",
    		name: "Stalwart Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55607",
    		name: "Mallet of Obliteration",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55608",
    		name: "Minotaur Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55609",
    		name: "Asterion's Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55610",
    		name: "Devastating Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55611",
    		name: "Misery Trooper Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55612",
    		name: "Torgan's Hammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55613",
    		name: "Ratkin Mining Pick",
    		slot: "MainHand"
    	},
    	{
    		id: "item_55614",
    		name: "Minotaur Warhammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56001",
    		name: "HumanClothBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56002",
    		name: "HumanClothBoots1-Red",
    		slot: "Feet"
    	},
    	{
    		id: "item_56003",
    		name: "HumanClothBoots1-Violet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56004",
    		name: "HumanClothPants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56005",
    		name: "HumanClothShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56006",
    		name: "HumanClothGloves1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56007",
    		name: "ElfClothBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56008",
    		name: "ElfClothPants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56009",
    		name: "ElfClothShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56010",
    		name: "ElfClothGloves1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56011",
    		name: "HumanPlateBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56012",
    		name: "HumanPlateBoots1-Red",
    		slot: "Feet"
    	},
    	{
    		id: "item_56013",
    		name: "HumanPlatePants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56014",
    		name: "HumanPlateShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56015",
    		name: "HumanPlateGloves1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56016",
    		name: "HumanPlateHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56017",
    		name: "RakLeatherShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56018",
    		name: "RakLeatherPants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56019",
    		name: "RakLeatherGloves1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56020",
    		name: "RakLeatherHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56021",
    		name: "RakLeatherBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56022",
    		name: "ElfLeatherShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56023",
    		name: "ElfLeatherPants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56024",
    		name: "ElfLeatherGloves1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56025",
    		name: "ElfLeatherHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56026",
    		name: "ElfLeatherBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56027",
    		name: "PoorClothShirt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56028",
    		name: "PoorClothPants1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56029",
    		name: "PoorClothBoots1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56030",
    		name: "HumanPlateShirt1B",
    		slot: "Chest"
    	},
    	{
    		id: "item_56031",
    		name: "HumanPlateGloves1B",
    		slot: "Hands"
    	},
    	{
    		id: "item_56032",
    		name: "HumanPlateHelm1B",
    		slot: "Head"
    	},
    	{
    		id: "item_56033",
    		name: "HumanPlateBoots1B",
    		slot: "Feet"
    	},
    	{
    		id: "item_56034",
    		name: "HumanPlatePants1B",
    		slot: "Legs"
    	},
    	{
    		id: "item_56035",
    		name: "PretendSword1",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56036",
    		name: "PretendShield1",
    		slot: "OffHand"
    	},
    	{
    		id: "item_56037",
    		name: "PretendStaff",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56038",
    		name: "PretendFlask",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56039",
    		name: "PretendBow",
    		slot: "OffHand"
    	},
    	{
    		id: "item_56040",
    		name: "PretendHammer",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56041",
    		name: "ChainmailFeet1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56042",
    		name: "ChainmailHands1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56043",
    		name: "ChainmailHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56044",
    		name: "ChainmailLegs1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56045",
    		name: "ChainmailChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56046",
    		name: "PlatemailFeet1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56047",
    		name: "PlatemailHands1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56048",
    		name: "PlatemailHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56049",
    		name: "PlatemailLegs1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56050",
    		name: "PlatemailChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56051",
    		name: "LeatherFeet1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56052",
    		name: "LeatherHands1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56053",
    		name: "LeatherHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56054",
    		name: "LeatherLegs1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56055",
    		name: "LeatherChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56056",
    		name: "ClothFeet1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56057",
    		name: "ClothHands1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56058",
    		name: "ClothHelm1",
    		slot: "Head"
    	},
    	{
    		id: "item_56059",
    		name: "ClothLegs1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56060",
    		name: "ClothChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56061",
    		name: "LeatherFeet2",
    		slot: "Feet"
    	},
    	{
    		id: "item_56062",
    		name: "LeatherHands2",
    		slot: "Hands"
    	},
    	{
    		id: "item_56063",
    		name: "LeatherHelm2",
    		slot: "Head"
    	},
    	{
    		id: "item_56064",
    		name: "LeatherLegs2",
    		slot: "Legs"
    	},
    	{
    		id: "item_56065",
    		name: "LeatherChest2",
    		slot: "Chest"
    	},
    	{
    		id: "item_56066",
    		name: "LeatherFeet3",
    		slot: "Feet"
    	},
    	{
    		id: "item_56067",
    		name: "LeatherHands3",
    		slot: "Hands"
    	},
    	{
    		id: "item_56068",
    		name: "LeatherHelm3",
    		slot: "Head"
    	},
    	{
    		id: "item_56069",
    		name: "LeatherLegs3",
    		slot: "Legs"
    	},
    	{
    		id: "item_56070",
    		name: "LeatherChest3",
    		slot: "Chest"
    	},
    	{
    		id: "item_56071",
    		name: "LeatherFeet4",
    		slot: "Feet"
    	},
    	{
    		id: "item_56072",
    		name: "LeatherHands4",
    		slot: "Hands"
    	},
    	{
    		id: "item_56073",
    		name: "LeatherHelm4",
    		slot: "Head"
    	},
    	{
    		id: "item_56074",
    		name: "LeatherLegs4",
    		slot: "Legs"
    	},
    	{
    		id: "item_56075",
    		name: "LeatherChest4",
    		slot: "Chest"
    	},
    	{
    		id: "item_56076",
    		name: "LeatherFeetOrc1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56077",
    		name: "LeatherHandsOrc1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56079",
    		name: "LeatherLegsOrc1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56080",
    		name: "LeatherChestOrc1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56081",
    		name: "LeatherHeadOrc1",
    		slot: "Head"
    	},
    	{
    		id: "item_56082",
    		name: "GoblinishLeatherFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56083",
    		name: "GoblinishLeatherHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56084",
    		name: "GoblinishLeatherLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56085",
    		name: "GoblinishLeatherChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56086",
    		name: "GoblinishLeatherHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56087",
    		name: "ElvishPlateFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56088",
    		name: "ElvishPlateHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56089",
    		name: "ElvishPlateLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56090",
    		name: "ElvishPlateChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56091",
    		name: "ElvishPlateHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56092",
    		name: "ArcherLeatherFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56093",
    		name: "ArcherLeatherHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56094",
    		name: "ArcherLeatherLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56095",
    		name: "ArcherLeatherChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56096",
    		name: "ArcherLeatherHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56097",
    		name: "MageClothFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56098",
    		name: "MageClothHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56099",
    		name: "MageClothLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56100",
    		name: "MageClothChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56101",
    		name: "MageClothHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56102",
    		name: "ThiefLeatherFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56103",
    		name: "ThiefLeatherHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56104",
    		name: "ThiefLeatherLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56105",
    		name: "ThiefLeatherChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56106",
    		name: "ThiefLeatherHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56107",
    		name: "SnailPlateFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56108",
    		name: "SnailPlateHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56109",
    		name: "SnailPlateLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56110",
    		name: "SnailPlateChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56111",
    		name: "SnailPlateHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56112",
    		name: "ArcticClothFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56113",
    		name: "ArcticClothHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56114",
    		name: "ArcticClothLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56115",
    		name: "ArcticClothChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56116",
    		name: "ArcticClothHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56117",
    		name: "SpiderWebFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56118",
    		name: "SpiderWebHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56119",
    		name: "SpiderWebLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56120",
    		name: "SpiderWebChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56121",
    		name: "SpiderWebHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56122",
    		name: "YetiArmorFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56123",
    		name: "YetiArmorHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56124",
    		name: "YetiArmorLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56125",
    		name: "YetiArmorChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56126",
    		name: "YetiArmorHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56127",
    		name: "ZombieSkinColoration",
    		slot: "Necklace"
    	},
    	{
    		id: "item_56128",
    		name: "NecroRobesFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56129",
    		name: "NecroRobesHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56130",
    		name: "NecroRobesLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56131",
    		name: "NecroRobesChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56132",
    		name: "NecroRobesHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56133",
    		name: "FeyPlateFeet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56134",
    		name: "FeyPlateHands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56135",
    		name: "FeyPlateLegs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56136",
    		name: "FeyPlateChest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56137",
    		name: "FeyPlateHead01",
    		slot: "Head"
    	},
    	{
    		id: "item_56138",
    		name: "ReinforcedPlatemailFeet1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56139",
    		name: "ReinforcedPlatemailHands1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56140",
    		name: "ReinforcedPlatemailHead1",
    		slot: "Head"
    	},
    	{
    		id: "item_56141",
    		name: "ReinforcedPlatemailLegs1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56142",
    		name: "ReinforcedPlatemailChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56143",
    		name: "BlackDressFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56144",
    		name: "BlackDressHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56145",
    		name: "BlackDressHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56146",
    		name: "BlackDressLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56147",
    		name: "BlackDressChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56148",
    		name: "ElegantClothFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56149",
    		name: "ElegantClothHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56150",
    		name: "ElegantClothHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56151",
    		name: "ElegantClothLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56152",
    		name: "ElegantClothChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56153",
    		name: "WolfPlatemailFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56154",
    		name: "WolfPlatemailHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56155",
    		name: "WolfPlatemailHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56156",
    		name: "WolfPlatemailLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56157",
    		name: "WolfPlatemailChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56158",
    		name: "ThorianPlatemailFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56159",
    		name: "ThorianPlatemailHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56160",
    		name: "ThorianPlatemailHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56161",
    		name: "ThorianPlatemailLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56162",
    		name: "ThorianPlatemailChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56163",
    		name: "Thorian2PlatemailFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56164",
    		name: "Thorian2PlatemailHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56165",
    		name: "Thorian2PlatemailHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56166",
    		name: "Thorian2PlatemailLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56167",
    		name: "Thorian2PlatemailChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56168",
    		name: "RakshashianLeatherFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56169",
    		name: "RakshashianLeatherHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56170",
    		name: "RakshashianLeatherHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56171",
    		name: "RakshashianLeatherLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56172",
    		name: "RakshashianLeatherChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56173",
    		name: "StuddedLeatherFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56174",
    		name: "StuddedLeatherHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56175",
    		name: "StuddedLeatherHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56176",
    		name: "StuddedLeatherLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56177",
    		name: "StuddedLeatherChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56178",
    		name: "RuggedLeatherFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56179",
    		name: "RuggedLeatherHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56180",
    		name: "RuggedLeatherHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56181",
    		name: "RuggedLeatherLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56182",
    		name: "RuggedLeatherChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56183",
    		name: "FeyPlateFeet02",
    		slot: "Feet"
    	},
    	{
    		id: "item_56184",
    		name: "FeyPlateHands02",
    		slot: "Hands"
    	},
    	{
    		id: "item_56185",
    		name: "FeyPlateLegs02",
    		slot: "Legs"
    	},
    	{
    		id: "item_56186",
    		name: "FeyPlateChest02",
    		slot: "Chest"
    	},
    	{
    		id: "item_56187",
    		name: "FeyPlateHead02",
    		slot: "Head"
    	},
    	{
    		id: "item_56188",
    		name: "SteelPlatemailFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56189",
    		name: "SteelPlatemailHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56190",
    		name: "SteelPlatemailHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56191",
    		name: "SteelPlatemailLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56192",
    		name: "SteelPlatemailChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56193",
    		name: "CowBarding",
    		slot: "Chest"
    	},
    	{
    		id: "item_56194",
    		name: "CowHelm",
    		slot: "Head"
    	},
    	{
    		id: "item_56195",
    		name: "FeyPlateFeet03",
    		slot: "Feet"
    	},
    	{
    		id: "item_56196",
    		name: "FeyPlateHands03",
    		slot: "Hands"
    	},
    	{
    		id: "item_56197",
    		name: "FeyPlateLegs03",
    		slot: "Legs"
    	},
    	{
    		id: "item_56198",
    		name: "FeyPlateChest03",
    		slot: "Chest"
    	},
    	{
    		id: "item_56199",
    		name: "FeyPlateHead03",
    		slot: "Head"
    	},
    	{
    		id: "item_56200",
    		name: "BarkeepClothFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56201",
    		name: "BarkeepClothHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56202",
    		name: "BarkeepClothLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56203",
    		name: "BarkeepClothChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56204",
    		name: "BarkeepClothHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56205",
    		name: "DruidOrganicFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56206",
    		name: "DruidOrganicHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56207",
    		name: "DruidOrganicLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56208",
    		name: "DruidOrganicChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56209",
    		name: "DruidOrganicHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56210",
    		name: "WingsOffAppearance",
    		slot: "Necklace"
    	},
    	{
    		id: "item_56211",
    		name: "GiantBonesAppearance",
    		slot: "Necklace"
    	},
    	{
    		id: "item_56212",
    		name: "Particle_DarknessDebuff",
    		slot: "Ring"
    	},
    	{
    		id: "item_56213",
    		name: "Giant2BonesAppearance",
    		slot: "Ring"
    	},
    	{
    		id: "item_56214",
    		name: "EnlargedAppearance",
    		slot: "Ring"
    	},
    	{
    		id: "item_56215",
    		name: "TailOffAppearance",
    		slot: "Racial"
    	},
    	{
    		id: "item_56216",
    		name: "InteriorEntityAppearance",
    		slot: "Ring"
    	},
    	{
    		id: "item_56221",
    		name: "MerchantRobesFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56222",
    		name: "MerchantRobesHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56223",
    		name: "MerchantRobesLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56224",
    		name: "MerchantRobesChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56225",
    		name: "MerchantRobesHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56226",
    		name: "ThiefLeatherFeetElectric",
    		slot: "Feet"
    	},
    	{
    		id: "item_56227",
    		name: "ThiefLeatherHandsElectric",
    		slot: "Hands"
    	},
    	{
    		id: "item_56228",
    		name: "ThiefLeatherLegsElectric",
    		slot: "Legs"
    	},
    	{
    		id: "item_56229",
    		name: "ThiefLeatherChestElectric",
    		slot: "Chest"
    	},
    	{
    		id: "item_56230",
    		name: "ThiefLeatherHeadElectric",
    		slot: "Head"
    	},
    	{
    		id: "item_56231",
    		name: "LeatherFeetOrc2",
    		slot: "Feet"
    	},
    	{
    		id: "item_56232",
    		name: "LeatherHandsOrc2",
    		slot: "Hands"
    	},
    	{
    		id: "item_56233",
    		name: "LeatherLegsOrc2",
    		slot: "Legs"
    	},
    	{
    		id: "item_56234",
    		name: "LeatherChestOrc2",
    		slot: "Chest"
    	},
    	{
    		id: "item_56235",
    		name: "LeatherHeadOrc2",
    		slot: "Head"
    	},
    	{
    		id: "item_56236",
    		name: "Rakshashian2LeatherFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56237",
    		name: "Rakshashian2LeatherHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56238",
    		name: "Rakshashian2LeatherHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56239",
    		name: "Rakshashian2LeatherLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56240",
    		name: "Rakshashian2LeatherChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56241",
    		name: "YetiFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56242",
    		name: "YetiHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56243",
    		name: "YetiLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56244",
    		name: "YetiChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56245",
    		name: "YetiHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56246",
    		name: "YetiFeet2",
    		slot: "Feet"
    	},
    	{
    		id: "item_56247",
    		name: "YetiHands2",
    		slot: "Hands"
    	},
    	{
    		id: "item_56248",
    		name: "YetiLegs2",
    		slot: "Legs"
    	},
    	{
    		id: "item_56249",
    		name: "YetiChest2",
    		slot: "Chest"
    	},
    	{
    		id: "item_56250",
    		name: "YetiHead2",
    		slot: "Head"
    	},
    	{
    		id: "item_56251",
    		name: "HighElfPlateFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56252",
    		name: "HighElfPlateHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56253",
    		name: "HighElfPlateLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56254",
    		name: "HighElfPlateChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56255",
    		name: "HighElfPlateHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56256",
    		name: "PretendCrossbow8",
    		slot: "OffHand"
    	},
    	{
    		id: "item_56257",
    		name: "PretendStaff2",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56258",
    		name: "PretendStaff3",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56259",
    		name: "PretendStaff4",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56301",
    		name: "MageClothFeet02",
    		slot: "Feet"
    	},
    	{
    		id: "item_56302",
    		name: "MageClothHands02",
    		slot: "Hands"
    	},
    	{
    		id: "item_56303",
    		name: "MageClothLegs02",
    		slot: "Legs"
    	},
    	{
    		id: "item_56304",
    		name: "MageClothChest02",
    		slot: "Chest"
    	},
    	{
    		id: "item_56305",
    		name: "MageClothHead02",
    		slot: "Head"
    	},
    	{
    		id: "item_56306",
    		name: "MageClothFeet03",
    		slot: "Feet"
    	},
    	{
    		id: "item_56307",
    		name: "MageClothHands03",
    		slot: "Hands"
    	},
    	{
    		id: "item_56308",
    		name: "MageClothLegs03",
    		slot: "Legs"
    	},
    	{
    		id: "item_56309",
    		name: "MageClothChest03",
    		slot: "Chest"
    	},
    	{
    		id: "item_56310",
    		name: "MageClothHead03",
    		slot: "Head"
    	},
    	{
    		id: "item_56311",
    		name: "MageCloth2Feet01",
    		slot: "Feet"
    	},
    	{
    		id: "item_56312",
    		name: "MageCloth2Hands01",
    		slot: "Hands"
    	},
    	{
    		id: "item_56313",
    		name: "MageCloth2Legs01",
    		slot: "Legs"
    	},
    	{
    		id: "item_56314",
    		name: "MageCloth2Chest01",
    		slot: "Chest"
    	},
    	{
    		id: "item_56315",
    		name: "MageCloth2Head01",
    		slot: "Head"
    	},
    	{
    		id: "item_56316",
    		name: "DarkElfPlateFeetRed",
    		slot: "Feet"
    	},
    	{
    		id: "item_56317",
    		name: "DarkElfPlateHandsRed",
    		slot: "Hands"
    	},
    	{
    		id: "item_56318",
    		name: "DarkElfPlateLegsRed",
    		slot: "Legs"
    	},
    	{
    		id: "item_56319",
    		name: "DarkElfPlateChestRed",
    		slot: "Chest"
    	},
    	{
    		id: "item_56320",
    		name: "DarkElfPlateHeadRed",
    		slot: "Head"
    	},
    	{
    		id: "item_56321",
    		name: "DarkElfPlateFeetBlue",
    		slot: "Feet"
    	},
    	{
    		id: "item_56322",
    		name: "DarkElfPlateHandsBlue",
    		slot: "Hands"
    	},
    	{
    		id: "item_56323",
    		name: "DarkElfPlateLegsBlue",
    		slot: "Legs"
    	},
    	{
    		id: "item_56324",
    		name: "DarkElfPlateChestBlue",
    		slot: "Chest"
    	},
    	{
    		id: "item_56325",
    		name: "DarkElfPlateHeadBlue",
    		slot: "Head"
    	},
    	{
    		id: "item_56326",
    		name: "DarkElfPlateFeetGreen",
    		slot: "Feet"
    	},
    	{
    		id: "item_56327",
    		name: "DarkElfPlateHandsGreen",
    		slot: "Hands"
    	},
    	{
    		id: "item_56328",
    		name: "DarkElfPlateLegsGreen",
    		slot: "Legs"
    	},
    	{
    		id: "item_56329",
    		name: "DarkElfPlateChestGreen",
    		slot: "Chest"
    	},
    	{
    		id: "item_56330",
    		name: "DarkElfPlateHeadGreen",
    		slot: "Head"
    	},
    	{
    		id: "item_56331",
    		name: "DarkElfPlateFeetGold",
    		slot: "Feet"
    	},
    	{
    		id: "item_56332",
    		name: "DarkElfPlateHandsGold",
    		slot: "Hands"
    	},
    	{
    		id: "item_56333",
    		name: "DarkElfPlateLegsGold",
    		slot: "Legs"
    	},
    	{
    		id: "item_56334",
    		name: "DarkElfPlateChestGold",
    		slot: "Chest"
    	},
    	{
    		id: "item_56335",
    		name: "DarkElfPlateHeadGold",
    		slot: "Head"
    	},
    	{
    		id: "item_56336",
    		name: "BarkeeperChest1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56341",
    		name: "MageCloth2Feet_WhiteRed",
    		slot: "Feet"
    	},
    	{
    		id: "item_56342",
    		name: "MageCloth2Hands_WhiteRed",
    		slot: "Hands"
    	},
    	{
    		id: "item_56343",
    		name: "MageCloth2Legs_WhiteRed",
    		slot: "Legs"
    	},
    	{
    		id: "item_56344",
    		name: "MageCloth2Chest_WhiteRed",
    		slot: "Chest"
    	},
    	{
    		id: "item_56345",
    		name: "MageCloth2Head_WhiteRed",
    		slot: "Head"
    	},
    	{
    		id: "item_56346",
    		name: "MageCloth2Feet_WhiteBlue",
    		slot: "Feet"
    	},
    	{
    		id: "item_56347",
    		name: "MageCloth2Hands_WhiteBlue",
    		slot: "Hands"
    	},
    	{
    		id: "item_56348",
    		name: "MageCloth2Legs_WhiteBlue",
    		slot: "Legs"
    	},
    	{
    		id: "item_56349",
    		name: "MageCloth2Chest_WhiteBlue",
    		slot: "Chest"
    	},
    	{
    		id: "item_56350",
    		name: "MageCloth2Head_WhiteBlue",
    		slot: "Head"
    	},
    	{
    		id: "item_56351",
    		name: "MageCloth2Feet_MuttererPurple",
    		slot: "Feet"
    	},
    	{
    		id: "item_56352",
    		name: "MageCloth2Hands_MuttererPurple",
    		slot: "Hands"
    	},
    	{
    		id: "item_56353",
    		name: "MageCloth2Legs_MuttererPurple",
    		slot: "Legs"
    	},
    	{
    		id: "item_56354",
    		name: "MageCloth2Chest_MuttererPurple",
    		slot: "Chest"
    	},
    	{
    		id: "item_56355",
    		name: "MageCloth2Head_MuttererPurple",
    		slot: "Head"
    	},
    	{
    		id: "item_56356",
    		name: "MageCloth2Feet_MuttererBlue",
    		slot: "Feet"
    	},
    	{
    		id: "item_56357",
    		name: "MageCloth2Hands_MuttererBlue",
    		slot: "Hands"
    	},
    	{
    		id: "item_56358",
    		name: "MageCloth2Legs_MuttererBlue",
    		slot: "Legs"
    	},
    	{
    		id: "item_56359",
    		name: "MageCloth2Chest_MuttererBlue",
    		slot: "Chest"
    	},
    	{
    		id: "item_56360",
    		name: "MageCloth2Head_MuttererBlue",
    		slot: "Head"
    	},
    	{
    		id: "item_56361",
    		name: "MageCloth2Feet_GoldWhite",
    		slot: "Feet"
    	},
    	{
    		id: "item_56362",
    		name: "MageCloth2Hands_GoldWhite",
    		slot: "Hands"
    	},
    	{
    		id: "item_56363",
    		name: "MageCloth2Legs_GoldWhite",
    		slot: "Legs"
    	},
    	{
    		id: "item_56364",
    		name: "MageCloth2Chest_GoldWhite",
    		slot: "Chest"
    	},
    	{
    		id: "item_56365",
    		name: "MageCloth2Head_GoldWhite",
    		slot: "Head"
    	},
    	{
    		id: "item_56366",
    		name: "BardLeatherFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56367",
    		name: "BardLeatherHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56368",
    		name: "BardLeatherLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56369",
    		name: "BardLeatherChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56370",
    		name: "BardLeatherHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56371",
    		name: "SantaHat",
    		slot: "Head"
    	},
    	{
    		id: "item_56372",
    		name: "SantaHatBlue",
    		slot: "Head"
    	},
    	{
    		id: "item_56373",
    		name: "MasqueradeMaskBlue",
    		slot: "Head"
    	},
    	{
    		id: "item_56374",
    		name: "MasqueradeMaskRed",
    		slot: "Head"
    	},
    	{
    		id: "item_56375",
    		name: "MasqueradeMaskGreen",
    		slot: "Head"
    	},
    	{
    		id: "item_56376",
    		name: "MasqueradeMaskWhite",
    		slot: "Head"
    	},
    	{
    		id: "item_56377",
    		name: "MasqueradeMaskYellow",
    		slot: "Head"
    	},
    	{
    		id: "item_56401",
    		name: "FeyPlateFeet1_WinterCourt1",
    		slot: "Feet"
    	},
    	{
    		id: "item_56402",
    		name: "FeyPlateHands1_WinterCourt1",
    		slot: "Hands"
    	},
    	{
    		id: "item_56403",
    		name: "FeyPlateLegs1_WinterCourt1",
    		slot: "Legs"
    	},
    	{
    		id: "item_56404",
    		name: "FeyPlateChest1_WinterCourt1",
    		slot: "Chest"
    	},
    	{
    		id: "item_56405",
    		name: "FeyPlateHead1_WinterCourt1",
    		slot: "Head"
    	},
    	{
    		id: "item_56406",
    		name: "FeyPlateFeet1_WinterCourt2",
    		slot: "Feet"
    	},
    	{
    		id: "item_56407",
    		name: "FeyPlateHands1_WinterCourt2",
    		slot: "Hands"
    	},
    	{
    		id: "item_56408",
    		name: "FeyPlateLegs1_WinterCourt2",
    		slot: "Legs"
    	},
    	{
    		id: "item_56409",
    		name: "FeyPlateChest1_WinterCourt2",
    		slot: "Chest"
    	},
    	{
    		id: "item_56410",
    		name: "FeyPlateHead1_WinterCourt2",
    		slot: "Head"
    	},
    	{
    		id: "item_56411",
    		name: "RanalonSkinFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56412",
    		name: "RanalonSkinHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56413",
    		name: "RanalonSkinLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56414",
    		name: "RanalonSkinChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56415",
    		name: "RanalonSkinHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56416",
    		name: "PretendColdWand",
    		slot: "MainHand"
    	},
    	{
    		id: "item_56417",
    		name: "FeyPlateFeetIllusory",
    		slot: "Feet"
    	},
    	{
    		id: "item_56418",
    		name: "FeyPlateHandsIllusory",
    		slot: "Hands"
    	},
    	{
    		id: "item_56419",
    		name: "FeyPlateLegsIllusory",
    		slot: "Legs"
    	},
    	{
    		id: "item_56420",
    		name: "FeyPlateChestIllusory",
    		slot: "Chest"
    	},
    	{
    		id: "item_56421",
    		name: "FeyPlateHeadIllusory",
    		slot: "Head"
    	},
    	{
    		id: "item_56422",
    		name: "DarkElfPlateFeetIllusory",
    		slot: "Feet"
    	},
    	{
    		id: "item_56423",
    		name: "DarkElfPlateHandsIllusory",
    		slot: "Hands"
    	},
    	{
    		id: "item_56424",
    		name: "DarkElfPlateLegsIllusory",
    		slot: "Legs"
    	},
    	{
    		id: "item_56425",
    		name: "DarkElfPlateChestIllusory",
    		slot: "Chest"
    	},
    	{
    		id: "item_56426",
    		name: "DarkElfPlateHeadIllusory",
    		slot: "Head"
    	},
    	{
    		id: "item_56427",
    		name: "WinterOrganicFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56428",
    		name: "WinterOrganicHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56429",
    		name: "WinterOrganicLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56430",
    		name: "WinterOrganicChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56431",
    		name: "ScienceFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56432",
    		name: "ScienceHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56433",
    		name: "ScienceLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56434",
    		name: "ScienceChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56436",
    		name: "MerchantRobesGreenFeet",
    		slot: "Feet"
    	},
    	{
    		id: "item_56437",
    		name: "MerchantRobesGreenHands",
    		slot: "Hands"
    	},
    	{
    		id: "item_56438",
    		name: "MerchantRobesGreenLegs",
    		slot: "Legs"
    	},
    	{
    		id: "item_56439",
    		name: "MerchantRobesGreenChest",
    		slot: "Chest"
    	},
    	{
    		id: "item_56440",
    		name: "MerchantRobesGreenHead",
    		slot: "Head"
    	},
    	{
    		id: "item_56441",
    		name: "SkeletonArcherSuit",
    		slot: "Head"
    	},
    	{
    		id: "item_56442",
    		name: "SkeletonMageSuit",
    		slot: "Head"
    	},
    	{
    		id: "item_56443",
    		name: "SkeletonWarriorSuit",
    		slot: "Head"
    	}
    ];
    var skills = [
    	{
    		name: "AnimalHandling"
    	},
    	{
    		name: "Archery"
    	},
    	{
    		name: "Axe"
    	},
    	{
    		name: "Bard"
    	},
    	{
    		name: "BattleChemistry"
    	},
    	{
    		name: "Cow"
    	},
    	{
    		name: "Deer"
    	},
    	{
    		name: "Druid"
    	},
    	{
    		name: "FireMagic"
    	},
    	{
    		name: "GiantBat"
    	},
    	{
    		name: "Hammer"
    	},
    	{
    		name: "IceMagic"
    	},
    	{
    		name: "Knife"
    	},
    	{
    		name: "Mentalism"
    	},
    	{
    		name: "Necromancy"
    	},
    	{
    		name: "Pig"
    	},
    	{
    		name: "Priest"
    	},
    	{
    		name: "Psychology"
    	},
    	{
    		name: "Rabbit"
    	},
    	{
    		name: "Shield"
    	},
    	{
    		name: "Spider"
    	},
    	{
    		name: "SpiritFox"
    	},
    	{
    		name: "Staff"
    	},
    	{
    		name: "Sword"
    	},
    	{
    		name: "Unarmed"
    	},
    	{
    		name: "Warden"
    	},
    	{
    		name: "Werewolf"
    	}
    ];
    var itemMods = [
    	{
    		id: "power_10001",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_ARCHERY}{0.4}"
    	},
    	{
    		id: "power_10002",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_SKILL_ARCHERY}{70}"
    	},
    	{
    		id: "power_10003",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Basic Shot and Aimed Shot heal you for 28 health"
    	},
    	{
    		id: "power_10004",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MAX_POWER}{29}{Archery}"
    	},
    	{
    		id: "power_10005",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Multishot and Heavy Multishot Damage +92 and Power Cost -16"
    	},
    	{
    		id: "power_10006",
    		skill: "Archery",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MITIGATION_PIERCING}{32}{Archery}"
    	},
    	{
    		id: "power_1001",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_SWORD}{0.4}"
    	},
    	{
    		id: "power_1002",
    		skill: "Sword",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "All sword abilities deal +17% damage when you have 33% or less of your Armor left"
    	},
    	{
    		id: "power_1003",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_SKILL_SWORD}{70}"
    	},
    	{
    		id: "power_1004",
    		skill: "Sword",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Sword Slash and Thrusting Blade restore 18 armor"
    	},
    	{
    		id: "power_10041",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_AIMEDSHOT}{0.39}"
    	},
    	{
    		id: "power_10042",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Aimed Shot deals 132 additional health damage over 12 seconds"
    	},
    	{
    		id: "power_10043",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Aimed Shot boosts your Nice Attack Damage +108 for 10 seconds"
    	},
    	{
    		id: "power_10044",
    		skill: "Archery",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Aimed Shot deals +30% damage and boosts your Accuracy +20 for 10 seconds"
    	},
    	{
    		id: "power_1005",
    		skill: "Sword",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Parry and Riposte Damage +20% and Power Cost -8"
    	},
    	{
    		id: "power_1006",
    		skill: "Sword",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_7",
    		effect: "All Sword abilities have a 22% chance to restore 30 Health to you"
    	},
    	{
    		id: "power_1007",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_17",
    		effect: "Many Cuts and Debilitating Blow Damage +71"
    	},
    	{
    		id: "power_1008",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_RIPOSTE}{0.62}"
    	},
    	{
    		id: "power_10081",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_MULTISHOT}{0.365}"
    	},
    	{
    		id: "power_10082",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Multishot restores 70 Health to you after a 15 second delay"
    	},
    	{
    		id: "power_10121",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_LONGSHOT}{0.56}"
    	},
    	{
    		id: "power_10122",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Long Shot boosts your Epic Attack Damage +16% for 15 seconds"
    	},
    	{
    		id: "power_10123",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Long Shot boosts your Armor Regeneration (in-combat) +16 for 15 seconds"
    	},
    	{
    		id: "power_10124",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Long Shot restores 49 health to you after a 15 second delay"
    	},
    	{
    		id: "power_10161",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEAVYSHOT}{0.4}"
    	},
    	{
    		id: "power_10162",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Blitz Shot and Basic Shot boost your healing from Combat Refreshes +8 for 30 seconds"
    	},
    	{
    		id: "power_10201",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Heavy Shot and Heavy Multishot Damage +17%"
    	},
    	{
    		id: "power_10202",
    		skill: "Archery",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Heavy Shot deals +14% damage and reuse timer is -5 seconds"
    	},
    	{
    		id: "power_1021",
    		skill: "Sword",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Many Cuts deals +132 armor damage"
    	},
    	{
    		id: "power_1022",
    		skill: "Sword",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Many Cuts deals +21% damage and stuns targets that have less than a third of their Armor remaining. However, Power cost is +33%"
    	},
    	{
    		id: "power_1023",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Many Cuts knocks back targets that have less than a third of their Armor, also dealing +40 damage"
    	},
    	{
    		id: "power_1024",
    		skill: "Sword",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Many Cuts and Debilitating Blow deal +134 damage to Arthropods (such as spiders, mantises, and beetles)"
    	},
    	{
    		id: "power_1025",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Precision Pierce deals +40 direct health damage and further reduces target's Rage by 240"
    	},
    	{
    		id: "power_1026",
    		skill: "Sword",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Wind Strike hastens the current reuse timer of Finishing Blow by 6 seconds"
    	},
    	{
    		id: "power_1027",
    		skill: "Sword",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Debilitating Blow hastens the current reuse timer of Decapitate by 8 seconds"
    	},
    	{
    		id: "power_1028",
    		skill: "Sword",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Many Cuts hits all enemies within 5 meters, dealing +30 damage"
    	},
    	{
    		id: "power_1029",
    		skill: "Sword",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_DECAPITATE_DELTA}{-11}"
    	},
    	{
    		id: "power_10301",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Fire Arrow deals an additional 240 Fire damage over 10 seconds"
    	},
    	{
    		id: "power_10302",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ACIDARROW}{0.68}"
    	},
    	{
    		id: "power_10303",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_POISONARROW}{0.59}"
    	},
    	{
    		id: "power_10304",
    		skill: "Archery",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fire Arrow, Poison Arrow, and Acid Arrow Damage +32%"
    	},
    	{
    		id: "power_10305",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Fire Arrow deals +22% damage and taunts +1175"
    	},
    	{
    		id: "power_10306",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Poison Arrow increases the damage target takes from Poison by 19% for 10 seconds"
    	},
    	{
    		id: "power_10307",
    		skill: "Archery",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_TAUNT_DELTA_ACIDARROW}{-1020}"
    	},
    	{
    		id: "power_10308",
    		skill: "Archery",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Fire Arrow suddenly deals an additional 320 indirect Fire damage after a 12 second delay"
    	},
    	{
    		id: "power_10309",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Poison Arrow makes target's attacks deal -10 damage for 20 seconds"
    	},
    	{
    		id: "power_10310",
    		skill: "Archery",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Acid Arrow generates no Taunt, generates no Rage, and reduces Rage by 625"
    	},
    	{
    		id: "power_10401",
    		skill: "Archery",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Snare Arrow boosts the healing of your Major Healing abilities +70 for 15 seconds"
    	},
    	{
    		id: "power_10402",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Basic Shot and Blitz Shot Damage +32%"
    	},
    	{
    		id: "power_10403",
    		skill: "Archery",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Snare Arrow raises target's Max Rage by 1200, requiring more Rage to use their Rage Abilities"
    	},
    	{
    		id: "power_10404",
    		skill: "Archery",
    		slots: [
    			"OffHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Snare Arrow restores 43 Health and 43 Armor to you"
    	},
    	{
    		id: "power_1041",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Parry and Riposte further reduce target's Rage by 680"
    	},
    	{
    		id: "power_1042",
    		skill: "Sword",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Parry restores 26 health"
    	},
    	{
    		id: "power_1043",
    		skill: "Sword",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Parry and Riposte Damage +49%"
    	},
    	{
    		id: "power_1044",
    		skill: "Sword",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Parry hits all enemies within 5 meters, dealing an additional +30 damage"
    	},
    	{
    		id: "power_1045",
    		skill: "Sword",
    		slots: [
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Riposte restores 53 armor"
    	},
    	{
    		id: "power_10451",
    		skill: "Archery",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Bow Bash gives you +8 mitigation of any physical damage for 20 seconds. (This effect does not stack with itself.)"
    	},
    	{
    		id: "power_10452",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Bow Bash heals you for 16 health"
    	},
    	{
    		id: "power_10453",
    		skill: "Archery",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEAVYMULTISHOT}{0.3}"
    	},
    	{
    		id: "power_10454",
    		skill: "Archery",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Bow Bash deals +180 damage and knocks the target backwards, but ability's reuse timer is +3 seconds"
    	},
    	{
    		id: "power_10455",
    		skill: "Archery",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Bow Bash deals +10% damage and taunts +305"
    	},
    	{
    		id: "power_10501",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Mangling Shot deals +43% damage and slows target's movement by 25%"
    	},
    	{
    		id: "power_10502",
    		skill: "Archery",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Mangling Shot deals 462 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_10503",
    		skill: "Archery",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Mangling Shot causes target to take +11.5% damage from Piercing for 10 seconds"
    	},
    	{
    		id: "power_10504",
    		skill: "Archery",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Mangling Shot deals +16% damage and causes target's attacks to deal -16 damage for 20 seconds"
    	},
    	{
    		id: "power_10505",
    		skill: "Archery",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RESTORATIVEARROW_SENDER}{76}"
    	},
    	{
    		id: "power_10506",
    		skill: "Archery",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Restorative Arrow heals YOU for 90 Health"
    	},
    	{
    		id: "power_10507",
    		skill: "Archery",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Restorative Arrow restores an additional 126 Health over 30 seconds"
    	},
    	{
    		id: "power_10508",
    		skill: "Archery",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Restorative Arrow boosts target's Nice Attack and Epic Attack Damage +144 for 10 seconds"
    	},
    	{
    		id: "power_1061",
    		skill: "Sword",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Wind Strike causes your next attack to deal +114 damage"
    	},
    	{
    		id: "power_1062",
    		skill: "Sword",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Wind Strike and Heart Piercer deal 124 armor damage"
    	},
    	{
    		id: "power_1063",
    		skill: "Sword",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Wind Strike deals +38% damage and gives you +16 Accuracy for 10 seconds (Accuracy cancels out the Evasion that certain monsters have)"
    	},
    	{
    		id: "power_1064",
    		skill: "Sword",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_1",
    		effect: "Finishing Blow gives you 25% resistance to Elemental damage (Fire, Cold, Electricity) for 10 seconds"
    	},
    	{
    		id: "power_1065",
    		skill: "Sword",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_1",
    		effect: "Wind Strike gives you +50% projectile evasion for 5 seconds"
    	},
    	{
    		id: "power_1066",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Flashing Strike and Hacking Blade Damage +29%"
    	},
    	{
    		id: "power_1081",
    		skill: "Sword",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Decapitate deals +80 damage and briefly terrifies the target"
    	},
    	{
    		id: "power_1082",
    		skill: "Sword",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_1",
    		effect: "Flashing Strike deals +25% damage and gives you 50% resistance to Darkness damage for 4 seconds"
    	},
    	{
    		id: "power_1083",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Finishing Blow restores 42 Power to you"
    	},
    	{
    		id: "power_1084",
    		skill: "Sword",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FINISHINGBLOW}{0.44}"
    	},
    	{
    		id: "power_1085",
    		skill: "Sword",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Finishing Blow and Decapitate damage +150"
    	},
    	{
    		id: "power_1086",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Finishing Blow restores 104 armor to you"
    	},
    	{
    		id: "power_11001",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_SHIELD}{0.4}"
    	},
    	{
    		id: "power_11011",
    		skill: "Shield",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SHIELDBASH}{0.2}"
    	},
    	{
    		id: "power_11012",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "All types of shield Bash attacks restore 21 Armor"
    	},
    	{
    		id: "power_11013",
    		skill: "Shield",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_1",
    		effect: "While the Shield skill is active, you mitigate 1 point of attack damage for every 20 Armor you have remaining. (Normally, you would mitigate 1 for every 25 Armor remaining.)"
    	},
    	{
    		id: "power_11014",
    		skill: "Shield",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "All Shield attacks have a 22% chance to conjure a force-shield that mitigates 10% of all slashing, crushing, and piercing damage for 30 seconds (or until 100 damage is absorbed). Stacks up to 5 times"
    	},
    	{
    		id: "power_11015",
    		skill: "Shield",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "All Shield attacks have a 22% chance to conjure a force-shield that mitigates 10% of all nature, darkness, demonic, and acid damage for 30 seconds (or until 100 damage is absorbed). Stacks up to 5 times"
    	},
    	{
    		id: "power_11051",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "When you are hit by a monster's Rage Attack, the current reuse timer of Stunning Bash is hastened by 1 second and your next Stunning Bash deals +80 damage"
    	},
    	{
    		id: "power_11052",
    		skill: "Shield",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_STUNNINGBASH}{0.8}"
    	},
    	{
    		id: "power_11101",
    		skill: "Shield",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MAX_ARMOR}{60}{Shield}"
    	},
    	{
    		id: "power_11102",
    		skill: "Shield",
    		slots: [
    			"OffHand",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Slashing Mitigation +6, Piercing Mitigation +6, Crushing Mitigation +6 while Shield skill active"
    	},
    	{
    		id: "power_11103",
    		skill: "Shield",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Max Armor +48, Direct Acid Mitigation +32, and Indirect Acid Mitigation +4 while Shield skill active"
    	},
    	{
    		id: "power_11104",
    		skill: "Shield",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MAX_ARMOR}{64}{Shield}"
    	},
    	{
    		id: "power_11105",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Stunning Bash causes the target to take 210 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_11201",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Disrupting Bash further reduces target's Rage by 740"
    	},
    	{
    		id: "power_11202",
    		skill: "Shield",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DISRUPTINGBASH}{0.67}"
    	},
    	{
    		id: "power_11203",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Disrupting Bash causes the next attack that hits you to deal 29 less damage"
    	},
    	{
    		id: "power_11251",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Infuriating Bash reduces the Power cost of melee attacks by 10 for 6 seconds"
    	},
    	{
    		id: "power_11252",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_INFURIATINGBASH}{0.55}"
    	},
    	{
    		id: "power_11253",
    		skill: "Shield",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Infuriating Bash deals +36% damage and taunts +330"
    	},
    	{
    		id: "power_11254",
    		skill: "Shield",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Infuriating Bash deals +48 damage and boosts your Indirect Acid Damage +54 for 7 seconds"
    	},
    	{
    		id: "power_11301",
    		skill: "Shield",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_1",
    		effect: "Strategic Preparation boosts your Indirect Acid Damage +25% for 20 seconds"
    	},
    	{
    		id: "power_11302",
    		skill: "Shield",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Strategic Preparation boosts your in-combat Armor regeneration +28 for 20 seconds"
    	},
    	{
    		id: "power_11303",
    		skill: "Shield",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Strategic Preparation causes your next attack to deal +130 damage if it is a Crushing, Slashing, or Piercing attack"
    	},
    	{
    		id: "power_11351",
    		skill: "Shield",
    		slots: [
    			"Head"
    		],
    		tierId: "id_7",
    		effect: "Elemental Ward mitigates +54 Darkness damage for 30 seconds"
    	},
    	{
    		id: "power_11352",
    		skill: "Shield",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Elemental Ward mitigates +55 direct Trauma damage for 30 seconds"
    	},
    	{
    		id: "power_11353",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Elemental Ward boosts your direct and indirect Electricity damage +40 for 30 seconds"
    	},
    	{
    		id: "power_11354",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Elemental Ward mitigates +32 elemental damage (Fire, Cold, and Electricity) for 30 seconds"
    	},
    	{
    		id: "power_11401",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Reinforce restores +105 Armor and Shield Team restores +53 Armor"
    	},
    	{
    		id: "power_11402",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "While Bulwark Mode is enabled you recover 26 Armor per second"
    	},
    	{
    		id: "power_11403",
    		skill: "Shield",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "When you are hit, all Shield abilities taunt +182 for 20 seconds (stacks up to 15 times)"
    	},
    	{
    		id: "power_11404",
    		skill: "Shield",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Reinforce causes your Major Healing abilities to restore +52 for 10 seconds"
    	},
    	{
    		id: "power_11405",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "When you are hit by a monster's Rage Attack, Reinforce restores +42 Armor for 60 seconds (stacks up to 10 times)"
    	},
    	{
    		id: "power_11451",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Shield Team grants all allies 17% evasion of burst attacks for 10 seconds"
    	},
    	{
    		id: "power_11452",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Disrupting Bash causes the target to take +10% damage from Crushing attacks for 8 seconds"
    	},
    	{
    		id: "power_11453",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Shield Team grants all allies +16 mitigation of all physical attacks (Crushing, Slashing, or Piercing) for 20 seconds"
    	},
    	{
    		id: "power_11454",
    		skill: "Shield",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "While Bulwark Mode is enabled you recover 10 Power per second"
    	},
    	{
    		id: "power_11455",
    		skill: "Shield",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Shield Team causes all targets' Survival Utility abilities to restore 100 Armor to them. Lasts 20 seconds"
    	},
    	{
    		id: "power_11456",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Reinforce boosts your Nice Attack Damage +160 for 9 seconds"
    	},
    	{
    		id: "power_11471",
    		skill: "Shield",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "While Bulwark Mode is active all your attacks taunt +50% and restore 17 Health to you"
    	},
    	{
    		id: "power_11472",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "While Bulwark Mode is active all your attacks taunt +50% and restore 26 Armor to you"
    	},
    	{
    		id: "power_11501",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Take the Lead heals you for 96 Health after a 15 second delay"
    	},
    	{
    		id: "power_11502",
    		skill: "Shield",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Take the Lead boosts your sprint speed by an additional +5 and you recover 36 Power after a 15 second delay"
    	},
    	{
    		id: "power_11503",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Take the Lead boosts the taunt of all your attacks +160%"
    	},
    	{
    		id: "power_11551",
    		skill: "Shield",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FIGHTMEYOUFOOLS}{0.53}"
    	},
    	{
    		id: "power_11552",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Fight Me You Fools deals +43% damage and taunts +500"
    	},
    	{
    		id: "power_11553",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Fight Me You Fools deals +18% damage and restores 96 Health over 8 seconds"
    	},
    	{
    		id: "power_11601",
    		skill: "Shield",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FINISHIT}{0.64}"
    	},
    	{
    		id: "power_11602",
    		skill: "Shield",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Finish It Damage +34% and Power Cost -19"
    	},
    	{
    		id: "power_11603",
    		skill: "Shield",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Finish It Restores 68 Health"
    	},
    	{
    		id: "power_11604",
    		skill: "Shield",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "When you are hit, Finish It damage is +64 for 20 seconds (stacks up to 10 times)"
    	},
    	{
    		id: "power_11605",
    		skill: "Shield",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "All Shield Bash Abilities deal +50 damage and hasten the current reuse timer of Finish It by 2 seconds"
    	},
    	{
    		id: "power_11651",
    		skill: "Shield",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_1",
    		effect: "Chance to Ignore Knockbacks +33%, Chance to Ignore Stuns +20%"
    	},
    	{
    		id: "power_11652",
    		skill: "Shield",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Fight Me You Fools boosts Core Attack Damage +200 for 6 seconds"
    	},
    	{
    		id: "power_11653",
    		skill: "Shield",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{AVOID_DEATH_CHANCE}{1.15}{Shield}"
    	},
    	{
    		id: "power_11701",
    		skill: "Shield",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "All Shield Bash Abilities deal +50 damage and hasten the current reuse timer of Fight Me You Fools by 2 seconds"
    	},
    	{
    		id: "power_11702",
    		skill: "Shield",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Fire Shield boosts your direct and indirect Cold mitigation +16 for 20 seconds"
    	},
    	{
    		id: "power_11703",
    		skill: "Shield",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Fire Shield boosts your direct and indirect Fire mitigation +16 for 20 seconds"
    	},
    	{
    		id: "power_11704",
    		skill: "Shield",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Fire Shield causes melee attackers to ignite, dealing 120 Fire damage over 10 seconds"
    	},
    	{
    		id: "power_11705",
    		skill: "Shield",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Fire Shield deals +96 Fire damage to melee attackers"
    	},
    	{
    		id: "power_12008",
    		skill: "AnimalHandling",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Shrill Command deals +36% damage and hastens the current reuse timer of Clever Trick by 2 seconds"
    	},
    	{
    		id: "power_12009",
    		skill: "AnimalHandling",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Shrill Command deals +34% damage and shortens the current reuse time of Sic 'Em by 1 second"
    	},
    	{
    		id: "power_1201",
    		skill: "Sword",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DECAPITATE}{0.475}"
    	},
    	{
    		id: "power_12010",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SHRILLCOMMAND}{0.42}"
    	},
    	{
    		id: "power_12011",
    		skill: "AnimalHandling",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Shrill Command deals +25% damage and reduces the target's Rage by -350"
    	},
    	{
    		id: "power_12012",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Monstrous Rage boosts your Slashing attack damage +18% for 8 seconds"
    	},
    	{
    		id: "power_12013",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Monstrous Rage boosts your Crushing attack damage +19% for 8 seconds"
    	},
    	{
    		id: "power_12014",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Monstrous Rage and Unnatural Wrath boost your pet's next attack damage +113"
    	},
    	{
    		id: "power_1202",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Decapitate restores 165 armor to you"
    	},
    	{
    		id: "power_12021",
    		skill: "AnimalHandling",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "When you use Sic Em, your sprint speed increases by +9 for 10 seconds"
    	},
    	{
    		id: "power_12022",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Sic Em boosts your pet's Slashing attacks (if any) +85 damage for 10 seconds"
    	},
    	{
    		id: "power_12023",
    		skill: "AnimalHandling",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Sic Em boosts your pet's Crushing attacks (if any) +85 damage for 10 seconds"
    	},
    	{
    		id: "power_12024",
    		skill: "AnimalHandling",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Sic Em gives both you and your pet +32 Accuracy for 10 seconds"
    	},
    	{
    		id: "power_12025",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Sic Em causes your pet's attacks to generate -221 Rage for 10 seconds"
    	},
    	{
    		id: "power_12026",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Sic 'Em restores 46 Health to both you and your pet"
    	},
    	{
    		id: "power_1203",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Decapitate deals +425 damage to non-Elite targets"
    	},
    	{
    		id: "power_12051",
    		skill: "AnimalHandling",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Get It Off Me increases your pet's Taunt an additional +280%"
    	},
    	{
    		id: "power_12052",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Get It Off Me restores 114 Armor to you"
    	},
    	{
    		id: "power_12053",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Get It Off Me heals you for 160 Health after a 15 second delay"
    	},
    	{
    		id: "power_12091",
    		skill: "AnimalHandling",
    		slots: [
    			"Ring",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Feed Pet restores 140 Health (or Armor if Health is full) to your pet after a 20 second delay"
    	},
    	{
    		id: "power_12092",
    		skill: "AnimalHandling",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Feed Pet restores 80 Armor to your pet and hastens the current reuse timer of Clever Trick by -4.5 second"
    	},
    	{
    		id: "power_12101",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_STABLEDPETHEAL_SENDER}{96}"
    	},
    	{
    		id: "power_12102",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Wild Endurance heals your pet for 120 Health (or Armor if Health is full)"
    	},
    	{
    		id: "power_12103",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Nimble Limbs heals your pet for 101 Health (or Armor if Health is full)"
    	},
    	{
    		id: "power_12104",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Using Unnatural Wrath on your pet heals you for 38 Health (or Armor if Health is full)"
    	},
    	{
    		id: "power_12105",
    		skill: "AnimalHandling",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Unnatural Wrath causes your pet to bleed for 160 trauma damage over 10 seconds, but also deal +144 damage per attack during that time"
    	},
    	{
    		id: "power_12106",
    		skill: "AnimalHandling",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Unnatural Wrath grants your pet +51% mitigation versus direct attacks for 14 seconds. After 15 seconds, the pet takes 160 psychic damage. (You can negate the latent psychic damage by using First Aid 4+ on your pet.)"
    	},
    	{
    		id: "power_12121",
    		skill: "AnimalHandling",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Wild Endurance gives your pet complete stun immunity and +8 Health/Armor healing per second for 15 seconds"
    	},
    	{
    		id: "power_12122",
    		skill: "AnimalHandling",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "After using Wild Endurance, your next use of Feed Pet restores +120 Health/Armor"
    	},
    	{
    		id: "power_12141",
    		skill: "AnimalHandling",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Nimble Limbs grants your pet +16 mitigation vs. physical (slashing, piercing, and crushing) attacks for 15 seconds"
    	},
    	{
    		id: "power_12161",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "That'll Do restores 72 Health to your pet and 32 Power to you"
    	},
    	{
    		id: "power_12191",
    		skill: "AnimalHandling",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_PIERCING_DIRECT}{0.16}{AnimalHandling}"
    	},
    	{
    		id: "power_12192",
    		skill: "AnimalHandling",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ELECTRICITY_DIRECT}{0.16}{AnimalHandling}"
    	},
    	{
    		id: "power_12193",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_COLD_DIRECT}{0.16}{AnimalHandling}"
    	},
    	{
    		id: "power_12301",
    		skill: "AnimalHandling",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets have +118 Max Health"
    	},
    	{
    		id: "power_12302",
    		skill: "AnimalHandling",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets have +151 Max Armor"
    	},
    	{
    		id: "power_12303",
    		skill: "AnimalHandling",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' Sic 'Em and Clever Trick attacks deal +100 damage"
    	},
    	{
    		id: "power_12304",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' Sic 'Em attacks deal +16% damage"
    	},
    	{
    		id: "power_12305",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' Sic 'Em abilities taunt +1200"
    	},
    	{
    		id: "power_12306",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets have +64 Enthusiasm (which boosts XP earned and critical-hit chance)"
    	},
    	{
    		id: "power_12307",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets taunt as if they did +160% additional damage"
    	},
    	{
    		id: "power_12308",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets taunt their opponents 32% less"
    	},
    	{
    		id: "power_12309",
    		skill: "AnimalHandling",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' damage-over-time effects (if any) deal +130% damage per tick"
    	},
    	{
    		id: "power_12310",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_1",
    		effect: "Animal Handling pets absorb some direct damage based on their remaining Armor (absorbing 0% when armor is empty, up to 20% when armor is full)"
    	},
    	{
    		id: "power_12311",
    		skill: "AnimalHandling",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets have +48% Death Avoidance (ignores a fatal attack once; resets after 15 minutes)"
    	},
    	{
    		id: "power_12312",
    		skill: "AnimalHandling",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets recover +17 Armor every five seconds (whether in combat or not)"
    	},
    	{
    		id: "power_12313",
    		skill: "AnimalHandling",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' healing abilities, if any, restore +45% health"
    	},
    	{
    		id: "power_12314",
    		skill: "AnimalHandling",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Nimble Limbs gives pet +19% melee evasion for 30 seconds"
    	},
    	{
    		id: "power_12315",
    		skill: "AnimalHandling",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' Clever Trick abilities deal +245 damage"
    	},
    	{
    		id: "power_12316",
    		skill: "AnimalHandling",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Animal Handling pets' Clever Trick abilities deal +20% damage"
    	},
    	{
    		id: "power_12317",
    		skill: "AnimalHandling",
    		slots: [
    			"MainHand",
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "For 17 seconds after using Clever Trick, pets' basic attacks have a 15% chance to deal double damage"
    	},
    	{
    		id: "power_12319",
    		skill: "AnimalHandling",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Animal Handling pets' basic attacks deal +13% damage"
    	},
    	{
    		id: "power_1251",
    		skill: "Sword",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Flashing Strike heals you for 55 health"
    	},
    	{
    		id: "power_1252",
    		skill: "Sword",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FLASHINGSTRIKE}{0.5}"
    	},
    	{
    		id: "power_1253",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Flashing Strike deals +217 damage to undead"
    	},
    	{
    		id: "power_13001",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_HAMMER}{0.4}"
    	},
    	{
    		id: "power_13002",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_SKILL_HAMMER}{85}"
    	},
    	{
    		id: "power_1301",
    		skill: "Sword",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Heart Piercer heals you for 40 health"
    	},
    	{
    		id: "power_13011",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Hammer attacks deal +16% damage but generate +48% Rage"
    	},
    	{
    		id: "power_13012",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Hammer attacks deal +20% damage to targets whose Rage meters are at least 66% full"
    	},
    	{
    		id: "power_13013",
    		skill: "Hammer",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Hammer attacks have a 16% chance to Knock Down targets whose Rage meter is at least 66% full"
    	},
    	{
    		id: "power_13014",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SEISMICIMPACT}{0.415}"
    	},
    	{
    		id: "power_13015",
    		skill: "Hammer",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Way of the Hammer boosts Slashing and Piercing Damage +34% for 10 seconds"
    	},
    	{
    		id: "power_13016",
    		skill: "Hammer",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Seismic Impact hits all targets within 8 meters and deals +17% damage"
    	},
    	{
    		id: "power_13017",
    		skill: "Hammer",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Seismic Impact restores 80 Armor to you"
    	},
    	{
    		id: "power_13018",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Seismic Impact deals +58% damage to targets that are Knocked Down"
    	},
    	{
    		id: "power_1302",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Heart Piercer removes (up to) 212 more Rage, turning half of that into Trauma damage"
    	},
    	{
    		id: "power_1303",
    		skill: "Sword",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Heart Piercer deals +18% piercing damage and heals you for 23 health"
    	},
    	{
    		id: "power_13043",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_REVERBERATINGSTRIKE}{0.25}"
    	},
    	{
    		id: "power_13044",
    		skill: "Hammer",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Way of the Hammer restores 80 Armor to all targets"
    	},
    	{
    		id: "power_13045",
    		skill: "Hammer",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_REVERBERATINGSTRIKE}{85}"
    	},
    	{
    		id: "power_13051",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_POUNDTOSLAG}{0.53}"
    	},
    	{
    		id: "power_13052",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Hurl Lightning and Thunderstrike Damage +30%"
    	},
    	{
    		id: "power_13053",
    		skill: "Hammer",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Pound To Slag restores 120 health to you"
    	},
    	{
    		id: "power_13054",
    		skill: "Hammer",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Pound To Slag deals +32% damage and hits all enemies within 5 meters, but reuse time is +10 seconds and Power cost is +35%"
    	},
    	{
    		id: "power_13055",
    		skill: "Hammer",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_7",
    		effect: "Pound To Slag deals +110 damage and hastens the current reuse timer of Look at My Hammer by 5 seconds"
    	},
    	{
    		id: "power_13056",
    		skill: "Hammer",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Way of the Hammer boosts all targets' Electricity Damage +35% for 10 seconds"
    	},
    	{
    		id: "power_13057",
    		skill: "Hammer",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Pound To Slag deals +512 damage if target's Rage is at least 66% full"
    	},
    	{
    		id: "power_13058",
    		skill: "Hammer",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Pound To Slag Damage +104 and Reuse Time -8 seconds"
    	},
    	{
    		id: "power_13101",
    		skill: "Hammer",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Look At My Hammer restores +82 health to you"
    	},
    	{
    		id: "power_13102",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Look At My Hammer restores +120 armor to you"
    	},
    	{
    		id: "power_13103",
    		skill: "Hammer",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Look At My Hammer reduces the damage you take from Slashing, Piercing, and Crushing attacks by 42 for 5 seconds"
    	},
    	{
    		id: "power_13104",
    		skill: "Hammer",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "After using Look At My Hammer, all other Hammer attacks cost -10 Power for 8 seconds"
    	},
    	{
    		id: "power_13105",
    		skill: "Hammer",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "After using Look At My Hammer, all other Hammer attacks cost -9 Power for 10 seconds"
    	},
    	{
    		id: "power_13106",
    		skill: "Hammer",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "After using Look At My Hammer, all other Hammer attacks cost -8 Power for 12 seconds"
    	},
    	{
    		id: "power_13151",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_LEAPINGSMASH}{0.7}"
    	},
    	{
    		id: "power_13152",
    		skill: "Hammer",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Leaping Smash and Latent Charge boost your Core Attack damage +91 for 6 seconds"
    	},
    	{
    		id: "power_13153",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Leaping Smash restores 52 Armor to you"
    	},
    	{
    		id: "power_13201",
    		skill: "Hammer",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_RIBSHATTER}{0.35}"
    	},
    	{
    		id: "power_13202",
    		skill: "Hammer",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Rib Shatter restores 40 Health to you"
    	},
    	{
    		id: "power_13203",
    		skill: "Hammer",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Hurl Lightning Damage +94 and Reuse Time -1 second"
    	},
    	{
    		id: "power_13204",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Rib Shatter deals +170 damage to targets that are knocked down"
    	},
    	{
    		id: "power_13205",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Way of the Hammer grants all targets +14 Direct Mitigation for 10 seconds"
    	},
    	{
    		id: "power_13251",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rib Shatter and Leaping Smash Damage +44% if target's Rage is at least 66% full"
    	},
    	{
    		id: "power_13252",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Thunderstrike heals you for 39 health"
    	},
    	{
    		id: "power_13253",
    		skill: "Hammer",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Thunderstrike deals +18% damage and knocks all targets back"
    	},
    	{
    		id: "power_13254",
    		skill: "Hammer",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_THUNDERSTRIKE}{128}"
    	},
    	{
    		id: "power_13301",
    		skill: "Hammer",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DISCHARGINGSTRIKE}{0.34}"
    	},
    	{
    		id: "power_13302",
    		skill: "Hammer",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Discharging Strike deals +8.5% damage plus 53% more damage if target's Rage meter is at least 66% full"
    	},
    	{
    		id: "power_13303",
    		skill: "Hammer",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Discharging Strike and Latent Charge boost your Epic Attack damage +90 for 15 seconds"
    	},
    	{
    		id: "power_13304",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_COST_DELTA_DISCHARGINGSTRIKE}{-23}"
    	},
    	{
    		id: "power_13305",
    		skill: "Hammer",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Hurl Lightning deals +20% damage and applies Moderate Concussion status: target is prone to random self-stuns"
    	},
    	{
    		id: "power_13351",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Reckless Slam boosts your direct damage mitigation +16 for 5 seconds"
    	},
    	{
    		id: "power_13352",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HURLLIGHTNING}{0.53}"
    	},
    	{
    		id: "power_13353",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_RECKLESSSLAM}{0.46}"
    	},
    	{
    		id: "power_13354",
    		skill: "Hammer",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_LATENTCHARGE}{0.49}"
    	},
    	{
    		id: "power_13355",
    		skill: "Hammer",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Reckless Slam deals +64 damage and taunts -285"
    	},
    	{
    		id: "power_13356",
    		skill: "Hammer",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Reckless Slam and Reverberating Strike boost your Nice Attack Damage +66 for 9 seconds"
    	},
    	{
    		id: "power_13401",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Latent Charge deals +240 Electricity damage after a 5 second delay"
    	},
    	{
    		id: "power_13402",
    		skill: "Hammer",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Reverberating Strike restores 96 armor after a 6-second delay"
    	},
    	{
    		id: "power_13403",
    		skill: "Hammer",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Latent Charge deals +80 direct damage. In addition, the target takes a second full blast of delayed Electricity damage after an 8-second delay"
    	},
    	{
    		id: "power_1351",
    		skill: "Sword",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Precision Pierce and Heart Piercer restore 18 Health to you"
    	},
    	{
    		id: "power_1352",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_PRECISIONPIERCE}{64}"
    	},
    	{
    		id: "power_1353",
    		skill: "Sword",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Precision Pierce deals +145% damage but its reuse timer is increased +3 seconds"
    	},
    	{
    		id: "power_1354",
    		skill: "Sword",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "For 6 seconds after using Precision Pierce, your Nice Attacks deal +64 damage"
    	},
    	{
    		id: "power_14001",
    		skill: "Druid",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_9",
    		effect: "{MOD_SKILL_DRUID}{0.45}"
    	},
    	{
    		id: "power_14002",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_NATURE_INDIRECT}{0.4}{Druid}"
    	},
    	{
    		id: "power_14003",
    		skill: "Druid",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MAX_HEALTH}{40}{Druid}"
    	},
    	{
    		id: "power_14004",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "All Druid abilities have a 30% chance to restore 15 Power to you"
    	},
    	{
    		id: "power_1401",
    		skill: "Sword",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_1",
    		effect: "{IGNORE_CHANCE_STUN}{0.25}{Sword}"
    	},
    	{
    		id: "power_14011",
    		skill: "Druid",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEARTTHORN}{0.74}"
    	},
    	{
    		id: "power_14012",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Heart Thorn coats the target in stinging insects that deal 306 Nature damage over 12 seconds"
    	},
    	{
    		id: "power_14013",
    		skill: "Druid",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Heart Thorn deals Poison damage (instead of Nature) and also deals 258 Poison damage over 12 seconds"
    	},
    	{
    		id: "power_14014",
    		skill: "Druid",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_PULSEOFLIFE_SENDER}{48}"
    	},
    	{
    		id: "power_14015",
    		skill: "Druid",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Pulse of Life restores 80 Health over 15 seconds"
    	},
    	{
    		id: "power_14016",
    		skill: "Druid",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Heart Thorn restores 74 armor to you"
    	},
    	{
    		id: "power_14017",
    		skill: "Druid",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Pulse of Life gives +18 Fire, Cold, and Electricity Mitigation (direct and indirect) for 15 seconds"
    	},
    	{
    		id: "power_14051",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ROTSKIN}{0.44}"
    	},
    	{
    		id: "power_14052",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rotskin deals 282 Trauma damage to health over 12 seconds"
    	},
    	{
    		id: "power_14053",
    		skill: "Druid",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rotskin hits all targets within 10 meters and further debuffs their mitigation -48"
    	},
    	{
    		id: "power_14054",
    		skill: "Druid",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_1",
    		effect: "Rotskin hastens the current reuse timer of Regrowth by 5 seconds"
    	},
    	{
    		id: "power_14055",
    		skill: "Druid",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Rotskin deals +20% damage and boosts your Nice Attack Damage +83 for 10 seconds"
    	},
    	{
    		id: "power_14101",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DELERIUM}{0.5}"
    	},
    	{
    		id: "power_14102",
    		skill: "Druid",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Delerium depletes +650 rage and taunts -480"
    	},
    	{
    		id: "power_14103",
    		skill: "Druid",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Delerium depletes +360 rage and deals +67 damage"
    	},
    	{
    		id: "power_14151",
    		skill: "Druid",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Health by +69 for 30 seconds and heals 69 Health"
    	},
    	{
    		id: "power_14152",
    		skill: "Druid",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Health by +69 for 30 seconds and heals 69 Health"
    	},
    	{
    		id: "power_14153",
    		skill: "Druid",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Armor by +95 for 30 seconds and restores 95 Armor"
    	},
    	{
    		id: "power_14154",
    		skill: "Druid",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Armor by +95 for 30 seconds and restores 95 Armor"
    	},
    	{
    		id: "power_14155",
    		skill: "Druid",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Power by +40 for 30 seconds and restores 40 Power"
    	},
    	{
    		id: "power_14156",
    		skill: "Druid",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin increases your Max Power by +40 for 30 seconds and restores 40 Power"
    	},
    	{
    		id: "power_14157",
    		skill: "Druid",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Brambleskin deals +96 Nature damage to melee attackers"
    	},
    	{
    		id: "power_14158",
    		skill: "Druid",
    		slots: [
    			"Head"
    		],
    		tierId: "id_1",
    		effect: "Cloud Sight causes target's attacks to have +5% more chance of missing, but Power cost is +15%"
    	},
    	{
    		id: "power_14201",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_COSMICSTRIKE}{0.62}"
    	},
    	{
    		id: "power_14202",
    		skill: "Druid",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Cosmic Strike deals +15% damage and boosts your Major Healing +80 for 10 seconds"
    	},
    	{
    		id: "power_14203",
    		skill: "Druid",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Cosmic Strike deals +208 damage, generates no Rage, and removes 565 Rage"
    	},
    	{
    		id: "power_14204",
    		skill: "Druid",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Cosmic Strike deals +115 damage and reuse timer is -5 seconds"
    	},
    	{
    		id: "power_14251",
    		skill: "Druid",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Fill With Bile heals 76 health and 76 armor"
    	},
    	{
    		id: "power_14252",
    		skill: "Druid",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Fill With Bile increases target's Max Health by +76 for 3 minutes and heals 76 health"
    	},
    	{
    		id: "power_14253",
    		skill: "Druid",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fill With Bile increases target's Max Health by +76 for 3 minutes and heals 76 health"
    	},
    	{
    		id: "power_14351",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_DRUIDHEAL_SENDER}{78}"
    	},
    	{
    		id: "power_14352",
    		skill: "Druid",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Regrowth restores 48 Power"
    	},
    	{
    		id: "power_14353",
    		skill: "Druid",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Regrowth restores +44 Health and conjures a magical field on the target that mitigates 10% of all physical damage they take for 1 minute (or until 100 damage is mitigated)"
    	},
    	{
    		id: "power_14354",
    		skill: "Druid",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Regrowth restores +35 Health and causes your Minor Heals to restore +46 Health for 10 seconds"
    	},
    	{
    		id: "power_14355",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Regrowth and Pulse of Life Healing +32%"
    	},
    	{
    		id: "power_14401",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Energize restores 97 armor to each target"
    	},
    	{
    		id: "power_14402",
    		skill: "Druid",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Energize restores +20 Health and conjures a magical field that mitigates 10% of all physical damage they take for 1 minute (or until 100 damage is mitigated)."
    	},
    	{
    		id: "power_14403",
    		skill: "Druid",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ENERGIZE_SENDER}{62}"
    	},
    	{
    		id: "power_14501",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Cloud Sight covers the target in insects that deal 240 Nature damage over 12 seconds"
    	},
    	{
    		id: "power_14502",
    		skill: "Druid",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Cloud Sight and Delerium Damage +36%"
    	},
    	{
    		id: "power_14503",
    		skill: "Druid",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CLOUDSIGHT}{0.425}"
    	},
    	{
    		id: "power_1451",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HACKINGBLADE}{0.38}"
    	},
    	{
    		id: "power_1452",
    		skill: "Sword",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Hacking Blade deals +192 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_1453",
    		skill: "Sword",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Hacking Blade and Debilitating Blow deal 138 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_1454",
    		skill: "Sword",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Hacking Blade generates no Rage, and instead reduces Rage by 325"
    	},
    	{
    		id: "power_14551",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_TOXINBALL}{0.63}"
    	},
    	{
    		id: "power_14552",
    		skill: "Druid",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Toxinball deals +186 Poison damage to health over 12 seconds"
    	},
    	{
    		id: "power_14553",
    		skill: "Druid",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_TOXINBALL}{-17}"
    	},
    	{
    		id: "power_14601",
    		skill: "Druid",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Your Healing Sanctuary restores +27 health with each heal"
    	},
    	{
    		id: "power_14602",
    		skill: "Druid",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Your Healing Sanctuary restores +40 Armor with each heal"
    	},
    	{
    		id: "power_14603",
    		skill: "Druid",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Your Healing Sanctuary restores +16 Power with each heal"
    	},
    	{
    		id: "power_14604",
    		skill: "Druid",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Fill With Bile increases target's direct Poison damage +51"
    	},
    	{
    		id: "power_14605",
    		skill: "Druid",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Your Healing Sanctuary heals +19 health and buffs Melee Accuracy +12"
    	},
    	{
    		id: "power_15001",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_ICEMAGIC}{0.4}"
    	},
    	{
    		id: "power_1501",
    		skill: "Sword",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DEBILITATINGBLOW}{0.55}"
    	},
    	{
    		id: "power_15011",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ICESPEAR}{0.33}"
    	},
    	{
    		id: "power_15012",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Ice Spear deals between +1 and +245 extra damage (randomly determined)"
    	},
    	{
    		id: "power_15013",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_ICESPEAR}{-19}"
    	},
    	{
    		id: "power_15014",
    		skill: "IceMagic",
    		slots: [
    			"OffHand",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Ice Spear heals you for 46 health after a 15 second delay"
    	},
    	{
    		id: "power_1502",
    		skill: "Sword",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Debilitating Blow deals +40 damage and causes your Core Attacks to deal +75 damage for 7 seconds"
    	},
    	{
    		id: "power_15031",
    		skill: "IceMagic",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "All Ice Magic abilities that hit multiple targets have a 20% chance to deal +50% damage"
    	},
    	{
    		id: "power_15032",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "All Ice Magic attacks that hit a single target have a 33% chance to deal +48% damage"
    	},
    	{
    		id: "power_15033",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Chill causes target to take +16% damage from Crushing attacks for 6 seconds, but reset time of Chill is increased +4 seconds"
    	},
    	{
    		id: "power_15051",
    		skill: "IceMagic",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Ice Nova and Shardblast deal +61 damage and cost -12 Power"
    	},
    	{
    		id: "power_15052",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "You regain 40 Health when using Ice Nova or Shardblast"
    	},
    	{
    		id: "power_15053",
    		skill: "IceMagic",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Ice Nova and Shardblast deal +43% damage"
    	},
    	{
    		id: "power_15054",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Ice Nova restores 60 Armor to you"
    	},
    	{
    		id: "power_15101",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Ice Armor mitigates +16 Physical and Cold damage, and mitigates +32 more against Elite attacks"
    	},
    	{
    		id: "power_15102",
    		skill: "IceMagic",
    		slots: [
    			"Legs",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Ice Armor costs -19 Power and restores 51 Power after a 6-second delay"
    	},
    	{
    		id: "power_15103",
    		skill: "IceMagic",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Ice Armor instantly restores 81 Armor, and Fire damage no longer dispels your Ice Armor"
    	},
    	{
    		id: "power_15104",
    		skill: "IceMagic",
    		slots: [
    			"OffHand",
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Ice Armor boosts direct and indirect Trauma Mitigation +42 and all attacks taunt +20%"
    	},
    	{
    		id: "power_15105",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Ice Armor boosts Cold attack damage +50"
    	},
    	{
    		id: "power_15106",
    		skill: "IceMagic",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Ice Armor instantly restores 80 Health"
    	},
    	{
    		id: "power_15151",
    		skill: "IceMagic",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Freeze Solid and Frostbite Damage +67%"
    	},
    	{
    		id: "power_15152",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Freeze Solid restores 112 armor to you"
    	},
    	{
    		id: "power_15153",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Freeze Solid reduces the Power cost of all Ice Magic abilities -11 for 7 seconds"
    	},
    	{
    		id: "power_15154",
    		skill: "IceMagic",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Ice Nova deals +120 damage and reuse timer is -2 seconds"
    	},
    	{
    		id: "power_15201",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Frostbite causes target's attacks to deal -18 damage"
    	},
    	{
    		id: "power_15202",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Frostbite deals +176 damage and raises the target's Max Rage by 33%, preventing them from using their Rage attacks as often"
    	},
    	{
    		id: "power_15203",
    		skill: "IceMagic",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Frostbite debuffs target so that 11% of their attacks miss and have no effect"
    	},
    	{
    		id: "power_15251",
    		skill: "IceMagic",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Tundra Spikes and Blizzard Damage +59%"
    	},
    	{
    		id: "power_15252",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Tundra Spikes deals 220 armor damage and taunts +600"
    	},
    	{
    		id: "power_15253",
    		skill: "IceMagic",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_4",
    		effect: "Tundra Spikes stuns all targets after a 8 second delay"
    	},
    	{
    		id: "power_15254",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Tundra Spikes deals +19% damage, gains +8 Accuracy, and lowers targets' Evasion by -16 for 20 seconds"
    	},
    	{
    		id: "power_15301",
    		skill: "IceMagic",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Blizzard has a 75% chance to cause all sentient targets to flee in terror"
    	},
    	{
    		id: "power_15302",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Blizzard deals +16% damage, generates -765 Rage and taunts -830"
    	},
    	{
    		id: "power_15303",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "You regain 64 Health when using Blizzard"
    	},
    	{
    		id: "power_15304",
    		skill: "IceMagic",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Blizzard Damage +255"
    	},
    	{
    		id: "power_15351",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ICELIGHTNING}{0.5}"
    	},
    	{
    		id: "power_15352",
    		skill: "IceMagic",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Ice Lightning boosts your Core Attack Damage +85 for 7 seconds"
    	},
    	{
    		id: "power_15353",
    		skill: "IceMagic",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Ice Lightning causes the target to become 17% more vulnerable to Fire attacks for 7 seconds"
    	},
    	{
    		id: "power_15354",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Ice Spear and Ice Lightning damage +26%"
    	},
    	{
    		id: "power_15401",
    		skill: "IceMagic",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Cryogenic Freeze restores 113 Health"
    	},
    	{
    		id: "power_15402",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Cryogenic Freeze restores 168 Armor"
    	},
    	{
    		id: "power_15403",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Cryogenic Freeze restores 68 Power"
    	},
    	{
    		id: "power_15404",
    		skill: "IceMagic",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "While in Cryogenic Freeze, you are 100% resistant to Fire damage"
    	},
    	{
    		id: "power_15405",
    		skill: "IceMagic",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "While in Cryogenic Freeze, you are 100% resistant to Poison damage"
    	},
    	{
    		id: "power_15451",
    		skill: "IceMagic",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ICEVEINS_SENDER}{85}"
    	},
    	{
    		id: "power_15452",
    		skill: "IceMagic",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Ice Veins heals 180 Health over 10 seconds"
    	},
    	{
    		id: "power_15453",
    		skill: "IceMagic",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Ice Veins heals +38 Health and Power cost is -30"
    	},
    	{
    		id: "power_15454",
    		skill: "IceMagic",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Ice Veins heals +17 Health and resets the timer on Ice Armor (so it can be used again immediately)"
    	},
    	{
    		id: "power_15501",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Your Cold Sphere's attacks deal +50% damage and taunt -25%"
    	},
    	{
    		id: "power_15502",
    		skill: "IceMagic",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Your Cold Sphere gains 90 Health"
    	},
    	{
    		id: "power_15503",
    		skill: "IceMagic",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Your Cold Sphere's Rage attack deals +260 damage"
    	},
    	{
    		id: "power_15504",
    		skill: "IceMagic",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Your Cold Sphere's attacks deal +38 damage and cause the targets to suffer +12% damage from future Cold attacks (non-stacking)"
    	},
    	{
    		id: "power_15505",
    		skill: "IceMagic",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Your Cold Sphere's attacks deals +170 damage, but their Max Health is -80"
    	},
    	{
    		id: "power_15551",
    		skill: "IceMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Shardblast deals +20% damage and resets the timer on Ice Armor (so it can be used again immediately)"
    	},
    	{
    		id: "power_16001",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_KNIFE}{0.4}"
    	},
    	{
    		id: "power_16002",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Knife abilities with 'Cut' in their name cause all Knife abilities WITHOUT 'Cut' in their name to have a 40% chance to deal +35% damage for 10 seconds"
    	},
    	{
    		id: "power_16003",
    		skill: "Knife",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_POISON_INDIRECT}{0.48}{Knife}, {MOD_TRAUMA_INDIRECT}{0.48}{Knife}"
    	},
    	{
    		id: "power_16004",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "When wielding two knives, all Knife Fighting attacks have a 33% chance to restore 33 Power"
    	},
    	{
    		id: "power_16005",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Fan of Blades, Hamstring Throw, and Surprise Throw deal +34% damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_16011",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Opening Thrust heals you for 14 health"
    	},
    	{
    		id: "power_16012",
    		skill: "Knife",
    		slots: [
    			"OffHand",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "For 5 seconds after using Opening Thrust, all knife abilities with 'Cut' in their name deal +24 damage"
    	},
    	{
    		id: "power_16013",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Opening Thrust has a 25% chance to cause all Knife abilities WITHOUT 'Cut' in their name to have a 32.5% chance to deal +35% damage for 10 seconds"
    	},
    	{
    		id: "power_16021",
    		skill: "Knife",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_MARKINGCUT}{0.74}"
    	},
    	{
    		id: "power_16022",
    		skill: "Knife",
    		slots: [
    			"Hands",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Marking Cut causes target to take +24% damage from Trauma attacks for 10 seconds"
    	},
    	{
    		id: "power_16023",
    		skill: "Knife",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Marking Cut deals +52 armor damage and does not cause the target to shout for help"
    	},
    	{
    		id: "power_16041",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Blur Cut deals 105 Poison damage over 10 seconds"
    	},
    	{
    		id: "power_16042",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Blur Cut restores 40 Health after a 15 second delay"
    	},
    	{
    		id: "power_16043",
    		skill: "Knife",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Blur Cut boosts Burst Evasion by 24% for 8 seconds"
    	},
    	{
    		id: "power_16044",
    		skill: "Knife",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Blur Cut grants a 37% chance to ignore stuns for 8 seconds"
    	},
    	{
    		id: "power_16061",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Slice deals 135 Poison damage over 10 seconds"
    	},
    	{
    		id: "power_16062",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Poisoner's Cut has a 50% chance to deal +115% damage"
    	},
    	{
    		id: "power_16063",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_POISONERSCUT}{0.495}"
    	},
    	{
    		id: "power_16064",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Poisoner's Cut boosts Indirect Poison Damage an additional +16 per tick"
    	},
    	{
    		id: "power_16081",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Fending Blade deals +52 damage and reduces Rage by 480"
    	},
    	{
    		id: "power_16082",
    		skill: "Knife",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fending Blade restores 24 Health to you immediately and reduces the target's Rage by 320 after a 5 second delay"
    	},
    	{
    		id: "power_16083",
    		skill: "Knife",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fending Blade restores 22 Power"
    	},
    	{
    		id: "power_16101",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SLICE}{0.36}"
    	},
    	{
    		id: "power_16102",
    		skill: "Knife",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Slice has a 40% chance to deal +45% damage and restore 85 armor"
    	},
    	{
    		id: "power_16103",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Slice ignores mitigation from armor and deals +76 damage"
    	},
    	{
    		id: "power_16121",
    		skill: "Knife",
    		slots: [
    			"Feet",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_VENOMSTRIKE}{0.42}"
    	},
    	{
    		id: "power_16122",
    		skill: "Knife",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Venomstrike deals an additional 192 Poison damage over 12 seconds"
    	},
    	{
    		id: "power_16123",
    		skill: "Knife",
    		slots: [
    			"OffHand",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Venomstrike has a 46% chance to stun the target and deal +48 damage"
    	},
    	{
    		id: "power_16141",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Gut deals an additional 200 Trauma damage over 10 seconds if the target is not focused on you"
    	},
    	{
    		id: "power_16142",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_GUT}{110}"
    	},
    	{
    		id: "power_16143",
    		skill: "Knife",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Gut deals +48 damage and if target is not focused on you, the trauma damage is boosted 25%"
    	},
    	{
    		id: "power_16144",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Gut deals +49% damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_16161",
    		skill: "Knife",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BACKSTAB}{0.46}"
    	},
    	{
    		id: "power_16162",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Backstab steals 97 health from the target and gives it to you"
    	},
    	{
    		id: "power_16163",
    		skill: "Knife",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Backstab deals an additional 555 Trauma damage over 10 seconds if the target is not focused on you."
    	},
    	{
    		id: "power_16181",
    		skill: "Knife",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Surge Cut restores +75 Health to you"
    	},
    	{
    		id: "power_16182",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Surge Cut restores 96 Armor to you"
    	},
    	{
    		id: "power_16183",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Surge Cut deals 205 Trauma damage over 10 seconds"
    	},
    	{
    		id: "power_16201",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HAMSTRINGTHROW}{0.62}"
    	},
    	{
    		id: "power_16202",
    		skill: "Knife",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Hamstring Throw deals +117 direct health damage"
    	},
    	{
    		id: "power_16203",
    		skill: "Knife",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Hamstring Throw deals +85 direct health damage and causes the target to take +15% damage from Trauma for 20 seconds"
    	},
    	{
    		id: "power_16221",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SURPRISETHROW}{0.62}"
    	},
    	{
    		id: "power_16222",
    		skill: "Knife",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Surprise Throw deals +35% damage and stuns the target if they are not focused on you"
    	},
    	{
    		id: "power_16223",
    		skill: "Knife",
    		slots: [
    			"Ring",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Surprise Throw restores 70 Power if the target is not focused on you"
    	},
    	{
    		id: "power_16241",
    		skill: "Knife",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FANOFBLADES}{0.32}"
    	},
    	{
    		id: "power_16242",
    		skill: "Knife",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Fan of Blades deals +15% damage to all targets and knocks them backwards"
    	},
    	{
    		id: "power_16243",
    		skill: "Knife",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Fan of Blades deals +76 damage and causes targets to take +20% damage from Poison for 30 seconds"
    	},
    	{
    		id: "power_17001",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_BARD}{0.4}"
    	},
    	{
    		id: "power_17002",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "{MAX_HEALTH}{40}{Bard}"
    	},
    	{
    		id: "power_17003",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_4",
    		effect: "Whenever you take damage from an enemy, you gain Bard Base Damage +8% for 15 seconds. (Stacks up to 10x)"
    	},
    	{
    		id: "power_17021",
    		skill: "Bard",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_BARDSONG}{-32}"
    	},
    	{
    		id: "power_17022",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "All bard songs restore 22 Health to YOU every 4 seconds"
    	},
    	{
    		id: "power_17023",
    		skill: "Bard",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "All bard songs restore 35 Armor to YOU every 4 seconds"
    	},
    	{
    		id: "power_17024",
    		skill: "Bard",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_2",
    		effect: "Your Bard Songs cost -20% Power. In addition, you can use the ability Hymn of Resurrection 2. (Equipping this item will teach you the ability if needed.)"
    	},
    	{
    		id: "power_17041",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SONGOFDISCORD}{0.16}"
    	},
    	{
    		id: "power_17042",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Song of Discord deals +21 damage and has a 5% chance to stun each target every 2 seconds"
    	},
    	{
    		id: "power_17043",
    		skill: "Bard",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Song of Discord reduces targets' Rage by -130 every 2 seconds"
    	},
    	{
    		id: "power_17044",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Song of Discord has a 45% chance to deal +25% damage to each target every 2 seconds"
    	},
    	{
    		id: "power_17045",
    		skill: "Bard",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_4",
    		effect: "Whenever you take damage from an enemy, you gain Song of Discord Damage +6% and Song of Resurgence Healing +6 for 20 seconds. (Stacks up to 12x)"
    	},
    	{
    		id: "power_17061",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_SONGOFRESURGENCE_SENDER}{18}"
    	},
    	{
    		id: "power_17062",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Song of Resurgence also restores 8 Power every 4 seconds to each target in range"
    	},
    	{
    		id: "power_17063",
    		skill: "Bard",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "While playing Song of Resurgence, your Major Healing abilities restore +50 Health"
    	},
    	{
    		id: "power_17081",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_2",
    		effect: "Song of Bravery has a 15% chance every 4 seconds to grant listeners a Moment of Bravery: all attacks deal +25% damage for 5 seconds"
    	},
    	{
    		id: "power_17082",
    		skill: "Bard",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Song of Bravery boosts allies' Basic Attack and Core Attack damage +55"
    	},
    	{
    		id: "power_17083",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Song of Bravery causes allies' Combat Refreshes to restore +76 Armor"
    	},
    	{
    		id: "power_17101",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_1",
    		effect: "{ABILITY_RANGE_DELTA_BARDBLAST}{5}"
    	},
    	{
    		id: "power_17121",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BLASTOFFURY}{0.51}"
    	},
    	{
    		id: "power_17122",
    		skill: "Bard",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Blast of Fury deals +42% damage and knocks the target back, but the ability's reuse timer is +2 seconds"
    	},
    	{
    		id: "power_17123",
    		skill: "Bard",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Blast of Fury deals 160 Armor damage and restores 35 Armor to you"
    	},
    	{
    		id: "power_17141",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BLASTOFDEFIANCE}{0.88}"
    	},
    	{
    		id: "power_17142",
    		skill: "Bard",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Blast of Defiance reaps +18% of the Health damage to you as healing. The reap cap is +80"
    	},
    	{
    		id: "power_17143",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Blast of Defiance reaps 19% of the Armor damage done (up to a max of 120), returning it to you as armor"
    	},
    	{
    		id: "power_17161",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Blast of Despair damage is +30% and reduces 180 more Rage"
    	},
    	{
    		id: "power_17162",
    		skill: "Bard",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Blast of Despair causes your Nice Attacks to deal +115 damage for 10 seconds"
    	},
    	{
    		id: "power_17163",
    		skill: "Bard",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Blast of Despair restores 34 Armor to you"
    	},
    	{
    		id: "power_17201",
    		skill: "Bard",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_THUNDEROUSNOTE}{0.4}"
    	},
    	{
    		id: "power_17202",
    		skill: "Bard",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Thunderous Note costs -9 Power and range is +6 meters"
    	},
    	{
    		id: "power_17203",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Thunderous Note causes the target to take +13% damage from Nature attacks for 15 seconds"
    	},
    	{
    		id: "power_17204",
    		skill: "Bard",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Thunderous Note deals +45% damage, and damage type is Nature instead of Trauma"
    	},
    	{
    		id: "power_17221",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RALLY_SENDER}{116}"
    	},
    	{
    		id: "power_17222",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Rally restores 47 Power"
    	},
    	{
    		id: "power_17223",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rally restores 170 Armor after a 20 second delay"
    	},
    	{
    		id: "power_17241",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Anthem of Avoidance gives all targets +23% Burst Evasion for 8 seconds"
    	},
    	{
    		id: "power_17242",
    		skill: "Bard",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Anthem of Avoidance gives all targets +18% Melee Evasion for 8 seconds"
    	},
    	{
    		id: "power_17243",
    		skill: "Bard",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_1",
    		effect: "Anthem of Avoidance grants all targets immunity to Knockbacks for 8 seconds"
    	},
    	{
    		id: "power_17244",
    		skill: "Bard",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_1",
    		effect: "Anthem of Avoidance hastens the current reuse timer of Rally by 5 seconds"
    	},
    	{
    		id: "power_17261",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ENTRANCINGLULLABY}{1.24}"
    	},
    	{
    		id: "power_17262",
    		skill: "Bard",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Entrancing Lullaby deals 450 Trauma damage after a 20 second delay"
    	},
    	{
    		id: "power_17263",
    		skill: "Bard",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Entrancing Lullaby and Anthem of Avoidance cost -30 Power"
    	},
    	{
    		id: "power_17281",
    		skill: "Bard",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Virtuoso's Ballad restores 61 Power"
    	},
    	{
    		id: "power_17282",
    		skill: "Bard",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Virtuoso's Ballad restores 160 Armor"
    	},
    	{
    		id: "power_17283",
    		skill: "Bard",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_6",
    		effect: "Virtuoso's Ballad and Moment of Resolve Reuse Timer -6 seconds"
    	},
    	{
    		id: "power_17301",
    		skill: "Bard",
    		slots: [
    			"Necklace",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_MOMENTOFRESOLVE_SENDER}{106}"
    	},
    	{
    		id: "power_17302",
    		skill: "Bard",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_1",
    		effect: "Moment of Resolve dispels any Stun effects on allies and grants them immunity to Stuns for 8 seconds"
    	},
    	{
    		id: "power_17303",
    		skill: "Bard",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_1",
    		effect: "Moment of Resolve dispels any Slow or Root effects on allies and grants them immunity to Slow and Root effects for 8 seconds"
    	},
    	{
    		id: "power_17304",
    		skill: "Bard",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_3",
    		effect: "Moment of Resolve boosts targets' Movement Speed +3 for 8 seconds"
    	},
    	{
    		id: "power_17321",
    		skill: "Bard",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Disharmony causes target to deal -8 damage with their next attack"
    	},
    	{
    		id: "power_17322",
    		skill: "Bard",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Disharmony causes target to deal -8 damage with their next attack"
    	},
    	{
    		id: "power_20001",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_COW}{0.4}"
    	},
    	{
    		id: "power_20002",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MAX_ARMOR}{80}{Cow}"
    	},
    	{
    		id: "power_20003",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Cow's Front Kick has a 66% chance to deal +132 damage"
    	},
    	{
    		id: "power_20004",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Stampede boosts the damage of future Stampede attacks by +38 for 60 seconds (stacks up to 15 times)"
    	},
    	{
    		id: "power_20005",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_TAUNT_DELTA_STAMPEDE}{440}"
    	},
    	{
    		id: "power_20006",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_COWFRONTKICK}{89}"
    	},
    	{
    		id: "power_20007",
    		skill: "Cow",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_COWBASH}{0.65}"
    	},
    	{
    		id: "power_20008",
    		skill: "Cow",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Cow's Bash deals +80 damage, taunts +800, and reuse timer is -1 second"
    	},
    	{
    		id: "power_20009",
    		skill: "Cow",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Cow's Bash heals you for 50 health"
    	},
    	{
    		id: "power_2001",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_FIREMAGIC}{0.4}"
    	},
    	{
    		id: "power_20010",
    		skill: "Cow",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Cow's Front Kick deals +35% damage and taunts +340"
    	},
    	{
    		id: "power_20011",
    		skill: "Cow",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Cow's Front Kick has a 50% chance to hit all enemies within 5 meters and deal +68 damage"
    	},
    	{
    		id: "power_20012",
    		skill: "Cow",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Cow's Front Kick causes the next attack that hits you to deal -39% damage"
    	},
    	{
    		id: "power_20013",
    		skill: "Cow",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Cow's Bash boosts your Nice Attack damage +160 for 9 seconds"
    	},
    	{
    		id: "power_20014",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Cow's Bash inflicts bugs on the target, dealing 310 Nature damage over 10 seconds"
    	},
    	{
    		id: "power_20015",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Indirect Nature and Indirect Trauma damage +40% while Cow skill active"
    	},
    	{
    		id: "power_20016",
    		skill: "Cow",
    		slots: [
    			"Head"
    		],
    		tierId: "id_5",
    		effect: "Stampede boosts your Slashing/Crushing/Piercing Mitigation vs. Elites +6 for 30 seconds (stacks up to 5 times)"
    	},
    	{
    		id: "power_20017",
    		skill: "Cow",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Cow's Bash costs -33 Power"
    	},
    	{
    		id: "power_20018",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Max Power +31 and Vulnerability to Elite Attacks -8% when Cow skill active"
    	},
    	{
    		id: "power_2002",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MITIGATION_FIRE_DIRECT}{48}{FireMagic}, {MITIGATION_FIRE_INDIRECT}{16}{FireMagic}"
    	},
    	{
    		id: "power_2003",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "All fire spells deal up to +115 damage (randomly determined)"
    	},
    	{
    		id: "power_2004",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Scintillating Flame and Scintillating Frost Damage +35%"
    	},
    	{
    		id: "power_20041",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Moo of Calm heals +80 health"
    	},
    	{
    		id: "power_20042",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Moo of Calm restores +50 power"
    	},
    	{
    		id: "power_20043",
    		skill: "Cow",
    		slots: [
    			"Feet",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Moo of Calm restores +100 armor"
    	},
    	{
    		id: "power_20044",
    		skill: "Cow",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "For 30 seconds after you use Moo of Calm, any internal (Poison/Trauma/Psychic) attacks that hit you are reduced by 32. This absorbed damage is added to your next Stampede attack at a 200% rate."
    	},
    	{
    		id: "power_2005",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Fire Breath and Super Fireball deal +165 damage over 10 seconds"
    	},
    	{
    		id: "power_2006",
    		skill: "FireMagic",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_FIRE_INDIRECT}{0.4}{FireMagic}"
    	},
    	{
    		id: "power_20061",
    		skill: "Cow",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Graze boosts your out-of-combat sprint speed by 8.5 for 30 seconds"
    	},
    	{
    		id: "power_20062",
    		skill: "Cow",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +14 for 10 seconds"
    	},
    	{
    		id: "power_20063",
    		skill: "Cow",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "For 10 seconds after using Moo of Determination, all attacks deal +56 damage"
    	},
    	{
    		id: "power_20064",
    		skill: "Cow",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "All Major Healing abilities targeting you restore +45 Health (while Cow skill active)"
    	},
    	{
    		id: "power_20065",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +14 for 10 seconds"
    	},
    	{
    		id: "power_20066",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Chew Cud's chance to consume grass is -34%"
    	},
    	{
    		id: "power_20067",
    		skill: "Cow",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Chew Cud increases your mitigation versus all attacks by Elites +34 for 10 seconds"
    	},
    	{
    		id: "power_2007",
    		skill: "FireMagic",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SUPERFIREBALL}{0.42}"
    	},
    	{
    		id: "power_2008",
    		skill: "FireMagic",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_FLESHTOFUEL_SENDER}{25}"
    	},
    	{
    		id: "power_2009",
    		skill: "FireMagic",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Fire Breath deals +72 damage and grants you +24 mitigation vs Fire for 10 seconds"
    	},
    	{
    		id: "power_2010",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_CRUSHINGBALL}{0.72}"
    	},
    	{
    		id: "power_20101",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CLOBBERINGHOOF}{0.52}"
    	},
    	{
    		id: "power_20102",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Clobbering Hoof attacks have a 50% chance to deal +102% damage"
    	},
    	{
    		id: "power_20103",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Clobbering Hoof deals +45% damage and taunts +400"
    	},
    	{
    		id: "power_20104",
    		skill: "Cow",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Clobbering Hoof infects the target, causing 220 Nature damage over 10 seconds"
    	},
    	{
    		id: "power_20105",
    		skill: "Cow",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Clobbering Hoof deals +35% damage and if target is Elite, reduces their attack damage 10% for 10 seconds"
    	},
    	{
    		id: "power_2011",
    		skill: "FireMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Fire Breath hits all targets within 8 meters and deals +24.5% damage, but reuse timer is +3 seconds and Power cost is +33%"
    	},
    	{
    		id: "power_2012",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Super Fireball deals +90 damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_2013",
    		skill: "FireMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FIREBREATH}{0.3}"
    	},
    	{
    		id: "power_2014",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_FIREMAGIC}{0.16}"
    	},
    	{
    		id: "power_2015",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Frostball, Scintillating Frost, and Defensive Chill boost your Nice Attack Damage +63 for 7 seconds"
    	},
    	{
    		id: "power_2016",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Calefaction causes target to take +16% damage from Cold for 12 seconds"
    	},
    	{
    		id: "power_2017",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Room-Temperature Ball and Defensive Burst cause the target's attacks to deal -16 damage for 10 seconds"
    	},
    	{
    		id: "power_2018",
    		skill: "FireMagic",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Super Fireball causes the target to take +60% damage from indirect Fire (this effect does not stack with itself)"
    	},
    	{
    		id: "power_2019",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Flesh to Fuel boosts your Core Attack Damage +118 for 7 seconds"
    	},
    	{
    		id: "power_2020",
    		skill: "FireMagic",
    		slots: [
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Flesh to Fuel restores +62 Armor"
    	},
    	{
    		id: "power_20201",
    		skill: "Cow",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "While Cow skill is active, you regenerate +32 Health every 5 seconds and resist +16 damage from Elite Crushing, Slashing, or Piercing attacks"
    	},
    	{
    		id: "power_20202",
    		skill: "Cow",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{TAUNT_MOD}{1.05}{Cow}"
    	},
    	{
    		id: "power_20203",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MAX_HEALTH}{60}{Cow}"
    	},
    	{
    		id: "power_20204",
    		skill: "Cow",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_CHEWCUD_SENDER}{44}"
    	},
    	{
    		id: "power_2021",
    		skill: "FireMagic",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Flesh to Fuel restores +34 Power but has a 5% chance to stun you"
    	},
    	{
    		id: "power_2022",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Flesh to Fuel increases your Out of Combat Sprint speed +8 for 15 seconds"
    	},
    	{
    		id: "power_2023",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Room-Temperature Ball deals Darkness damage and causes +126 damage over 12 seconds"
    	},
    	{
    		id: "power_2024",
    		skill: "FireMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Room-Temperature Ball Damage +26% and reuse timer -3.5 seconds"
    	},
    	{
    		id: "power_20301",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Moo of Determination restores +110 armor"
    	},
    	{
    		id: "power_20302",
    		skill: "Cow",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Moo of Determination restores 144 Health over 9 seconds"
    	},
    	{
    		id: "power_20303",
    		skill: "Cow",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "For 30 seconds after you use Moo of Determination, any physical (Slashing/Piercing/Crushing) attacks that hit you are reduced by 24. This absorbed damage is added to your next Front Kick."
    	},
    	{
    		id: "power_20351",
    		skill: "Cow",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Tough Hoof deals +43% damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_20352",
    		skill: "Cow",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Tough Hoof immediately restores 73 armor"
    	},
    	{
    		id: "power_20353",
    		skill: "Cow",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Tough Hoof costs -26 Power and mitigates +11% of all Elite attacks for 8 seconds"
    	},
    	{
    		id: "power_20354",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_TOUGHHOOF_RECEIVER}{48}"
    	},
    	{
    		id: "power_20355",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Tough Hoof deals 144 Trauma damage to the target each time they attack and damage you (within 8 seconds)"
    	},
    	{
    		id: "power_20356",
    		skill: "Cow",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Tough Hoof deals +132 damage and taunts +950"
    	},
    	{
    		id: "power_20401",
    		skill: "Cow",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DEADLYEMISSION}{0.38}"
    	},
    	{
    		id: "power_20402",
    		skill: "Cow",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Deadly Emission Damage +80 and Reuse Timer -1 second"
    	},
    	{
    		id: "power_20403",
    		skill: "Cow",
    		slots: [
    			"MainHand",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Deadly Emission Deals +415 Nature damage over 10 seconds and Taunts +400"
    	},
    	{
    		id: "power_20405",
    		skill: "Cow",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Deadly Emission Damage +46 and Targets are Knocked Backwards"
    	},
    	{
    		id: "power_20406",
    		skill: "Cow",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Deadly Emission Deals +170 Nature damage over 10 seconds and reduces targets' next attack by 35%"
    	},
    	{
    		id: "power_2051",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "You regain 20 Power when using Ring of Fire, Defensive Burst, or Defensive Chill"
    	},
    	{
    		id: "power_2052",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "You regain 31 Health when using Ring of Fire, Defensive Burst, or Defensive Chill"
    	},
    	{
    		id: "power_2053",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Scintillating Flame and Scintillating Frost Damage +30 and Power Cost -10"
    	},
    	{
    		id: "power_2054",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Scintillating Flame restores 33 Health"
    	},
    	{
    		id: "power_2055",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Scintillating Flame and Molten Veins boost your Core Attack Damage and Epic Attack Damage +39 for 15 seconds"
    	},
    	{
    		id: "power_2056",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_RINGOFFIRE}{152}"
    	},
    	{
    		id: "power_2057",
    		skill: "FireMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Scintillating Flame and Scintillating Frost stun and deal +100% damage to Vulnerable targets"
    	},
    	{
    		id: "power_2058",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Ring of Fire deals +49% damage but has a 5% chance to deal 140 fire damage to YOU"
    	},
    	{
    		id: "power_2059",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Scintillating Frost and Defensive Chill restore 31 Armor"
    	},
    	{
    		id: "power_21001",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_DEER}{0.4}"
    	},
    	{
    		id: "power_21002",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Deer Kick deals +47 damage and grants you -10% Fire Vulnerability for 10 seconds"
    	},
    	{
    		id: "power_21003",
    		skill: "Deer",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Combo: Deer Bash+Any Melee+Any Melee+Deer Kick: final step hits all enemies within 5 meters and deals +240 damage."
    	},
    	{
    		id: "power_21004",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Deer Kick implants insect eggs in the target. (Max 4 stacks.) Future Deer Kicks by any pet deer or player deer will cause target to take 310 Nature damage over 5 seconds"
    	},
    	{
    		id: "power_21005",
    		skill: "Deer",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Deer Kick deals +70 damage and reduces target's Rage by -160"
    	},
    	{
    		id: "power_21006",
    		skill: "Deer",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Deer Kick deals +29% damage and taunts +252"
    	},
    	{
    		id: "power_2101",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_REFLECT_MOLTENVEINS}{57}"
    	},
    	{
    		id: "power_2102",
    		skill: "FireMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_REFLECT_MOLTENVEINS}{0.22}"
    	},
    	{
    		id: "power_21021",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Deer Bash has a 15% chance to summon a deer ally for 30 seconds"
    	},
    	{
    		id: "power_21022",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DEERBASH}{0.58}"
    	},
    	{
    		id: "power_21023",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Deer Bash has a 60% chance to deal +110% damage"
    	},
    	{
    		id: "power_21024",
    		skill: "Deer",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Deer Bash heals 40 health"
    	},
    	{
    		id: "power_2103",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Molten Veins restores 55 Armor"
    	},
    	{
    		id: "power_2104",
    		skill: "FireMagic",
    		slots: [
    			"OffHand",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Molten Veins deals 85 Fire damage over 10 seconds in response to melee damage"
    	},
    	{
    		id: "power_21041",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Doe Eyes reuse timer is -2 seconds, and after using Doe Eyes your next attack deals +190 damage"
    	},
    	{
    		id: "power_21042",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Doe Eyes mitigates +16 physical damage (Crushing, Slashing, Piercing) for 24 seconds. Against Elite enemies, mitigates +32 more"
    	},
    	{
    		id: "power_21043",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Doe Eyes restores 44 power"
    	},
    	{
    		id: "power_21044",
    		skill: "Deer",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "For 10 seconds after using Doe Eyes, you mitigate +36 from all attacks, and a further +72 from Elite attacks"
    	},
    	{
    		id: "power_21061",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_CUTENESSOVERLOAD}{270}"
    	},
    	{
    		id: "power_21062",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Cuteness Overload heals you for 72 health and increases your movement speed by +6 for 8 seconds"
    	},
    	{
    		id: "power_21063",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MAX_POWER}{31}{Deer}, {NONCOMBAT_SPRINT_BOOST}{4.5}{Deer}"
    	},
    	{
    		id: "power_21064",
    		skill: "Deer",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CUTENESSOVERLOAD}{0.6}"
    	},
    	{
    		id: "power_21065",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Cuteness Overload restores 135 armor to you"
    	},
    	{
    		id: "power_21066",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Cuteness Overload deals 522 Psychic health damage over 12 seconds"
    	},
    	{
    		id: "power_21067",
    		skill: "Deer",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Cuteness Overload deals +160 damage and knocks the target backwards"
    	},
    	{
    		id: "power_21081",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "King of the Forest has a 90% chance to deal +160 damage"
    	},
    	{
    		id: "power_21082",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_KINGOFTHEFOREST}{0.52}"
    	},
    	{
    		id: "power_21083",
    		skill: "Deer",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "King of the Forest mitigates +14 physical damage (Crushing, Slashing, Piercing) for 10 seconds. Against Elite enemies, mitigates +28 more"
    	},
    	{
    		id: "power_21101",
    		skill: "Deer",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Direct and indirect Psychic and Nature Mitigation +32 while Deer skill active"
    	},
    	{
    		id: "power_21102",
    		skill: "Deer",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Burst Evasion +8.5% while Deer skill active"
    	},
    	{
    		id: "power_21151",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_PUMMELINGHOOVES}{0.38}"
    	},
    	{
    		id: "power_21152",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Pummeling Hooves deals +21% damage and taunts +455"
    	},
    	{
    		id: "power_21153",
    		skill: "Deer",
    		slots: [
    			"Necklace",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Pummeling Hooves has a 60% chance to deal +66% damage and taunt +400"
    	},
    	{
    		id: "power_21154",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Pummeling Hooves deals +45 damage and has a 8% chance to summon a deer ally for 30 seconds"
    	},
    	{
    		id: "power_21201",
    		skill: "Deer",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Summoned Deer have +54 health"
    	},
    	{
    		id: "power_21202",
    		skill: "Deer",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Summoned Deer have +57 armor"
    	},
    	{
    		id: "power_21203",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Summoned Deer deal +20% damage with each attack"
    	},
    	{
    		id: "power_21204",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Summoned Deer Rage Attack Damage +147"
    	},
    	{
    		id: "power_21251",
    		skill: "Deer",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Bounding Escape heals you for 72 health"
    	},
    	{
    		id: "power_21252",
    		skill: "Deer",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Bounding Escape restores 117 armor to you"
    	},
    	{
    		id: "power_21253",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Bounding Escape restores 44 power to you"
    	},
    	{
    		id: "power_21254",
    		skill: "Deer",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Bounding Escape grants you +42% Projectile Evasion for 10 seconds"
    	},
    	{
    		id: "power_21301",
    		skill: "Deer",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Antler Slash restores 8 power to you"
    	},
    	{
    		id: "power_21302",
    		skill: "Deer",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Antler Slash hits all enemies within 5 meters and taunts +470"
    	},
    	{
    		id: "power_21303",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Antler Slash heals you for 16 health"
    	},
    	{
    		id: "power_21304",
    		skill: "Deer",
    		slots: [
    			"MainHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "You can use the Deer ability Feign Injury, and it temp-taunts +11300. (Equipping this item will teach you the ability if needed.)"
    	},
    	{
    		id: "power_21351",
    		skill: "Deer",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FORESTCHALLENGE}{0.59}"
    	},
    	{
    		id: "power_21352",
    		skill: "Deer",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_FORESTCHALLENGE}{80}, {ABILITY_TAUNT_DELTA_FORESTCHALLENGE}{1280}"
    	},
    	{
    		id: "power_21353",
    		skill: "Deer",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Forest Challenge raises Max Health +52 for 60 seconds (and heals +52)"
    	},
    	{
    		id: "power_21354",
    		skill: "Deer",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Forest Challenge damage is +118 and reuse time is -1 second"
    	},
    	{
    		id: "power_21355",
    		skill: "Deer",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Forest Challenge and King of the Forest power cost is -20"
    	},
    	{
    		id: "power_21356",
    		skill: "Deer",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Combo: Forest Challenge+Any Melee+Any Melee+Any Epic Attack: final step deals +120 damage and summons a deer ally for 30 seconds."
    	},
    	{
    		id: "power_2151",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CALEFACTION}{0.52}"
    	},
    	{
    		id: "power_2152",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Calefaction and Defensive Burst Damage +33% and Reuse Timer -1 second"
    	},
    	{
    		id: "power_2153",
    		skill: "FireMagic",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Calefaction restores 45 Health"
    	},
    	{
    		id: "power_2154",
    		skill: "FireMagic",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Calefaction deals 213 additional Fire damage after a 12 second delay"
    	},
    	{
    		id: "power_22001",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_PIG}{0.4}"
    	},
    	{
    		id: "power_22002",
    		skill: "Pig",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_PIGBITE}{26}"
    	},
    	{
    		id: "power_22003",
    		skill: "Pig",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Pig Bite has a 44% chance to deal +40 damage and hit all targets within 5 meters"
    	},
    	{
    		id: "power_22004",
    		skill: "Pig",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Pig Bite restores 16 Health"
    	},
    	{
    		id: "power_22005",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_TAUNT_DELTA_PIGBITE}{-160}"
    	},
    	{
    		id: "power_2201",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Fireball and Frostball Damage +36%"
    	},
    	{
    		id: "power_2202",
    		skill: "FireMagic",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Frostball targets all enemies within 10 meters and deals +52 damage, but reuse timer is +3 seconds"
    	},
    	{
    		id: "power_22021",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_PIGREND}{127}"
    	},
    	{
    		id: "power_2203",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Frostball slows target's movement by 25% and deals +16 damage"
    	},
    	{
    		id: "power_2204",
    		skill: "FireMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Defensive Burst deals +19% damage and raises Basic Attack Damage +28% for 10 seconds"
    	},
    	{
    		id: "power_22041",
    		skill: "Pig",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Grunt of Abeyance restores 28 Power to all targets"
    	},
    	{
    		id: "power_22042",
    		skill: "Pig",
    		slots: [
    			"OffHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_GRUNTOFABEYANCE_HEALTH_SENDER}{42}"
    	},
    	{
    		id: "power_22043",
    		skill: "Pig",
    		slots: [
    			"OffHand",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Grunt of Abeyance restores 61 Armor to all targets"
    	},
    	{
    		id: "power_2205",
    		skill: "FireMagic",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "When you are near your Fire Wall, you heal 10 Health per second"
    	},
    	{
    		id: "power_2206",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DEFENSIVECHILL}{0.38}"
    	},
    	{
    		id: "power_22061",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Grunt of Abeyance grants all targets 20% mitigation from attacks, up to a maximum of 200 total mitigated damage."
    	},
    	{
    		id: "power_2207",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Frostball, Scintillating Frost, and Defensive Chill grant +10 Direct and Indirect Cold Protection for 10 seconds"
    	},
    	{
    		id: "power_22079",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Strategic Chomp deals +36% damage and generates 350 less Rage"
    	},
    	{
    		id: "power_2208",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Defensive Burst and Defensive Chill restore 42 Armor to you"
    	},
    	{
    		id: "power_22080",
    		skill: "Pig",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Strategic Chomp deals +84 damage and taunts -165"
    	},
    	{
    		id: "power_22081",
    		skill: "Pig",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_STRATEGICCHOMP}{0.58}"
    	},
    	{
    		id: "power_22082",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Strategic Chomp boosts your mitigation versus physical damage +8 for 20 seconds"
    	},
    	{
    		id: "power_22083",
    		skill: "Pig",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Strategic Chomp restores 21 Power"
    	},
    	{
    		id: "power_22084",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MITIGATION_POISON_DIRECT}{48}{Pig}, {MITIGATION_POISON_INDIRECT}{16}{Pig}"
    	},
    	{
    		id: "power_22085",
    		skill: "Pig",
    		slots: [
    			"Hands",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Pig Rend has a 60% chance to deal +84% damage"
    	},
    	{
    		id: "power_22086",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Pig Rend deals +240 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_22087",
    		skill: "Pig",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MITIGATION_ELECTRICITY_DIRECT}{48}{Pig}, {MITIGATION_ELECTRICITY_INDIRECT}{16}{Pig}"
    	},
    	{
    		id: "power_22088",
    		skill: "Pig",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MAX_ARMOR}{80}{Pig}"
    	},
    	{
    		id: "power_2209",
    		skill: "FireMagic",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Defensive Chill deals +46 damage and grants you 70% chance to ignore Knockback effects for 7 seconds"
    	},
    	{
    		id: "power_22201",
    		skill: "Pig",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SQUEAL}{1.14}"
    	},
    	{
    		id: "power_22202",
    		skill: "Pig",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Squeal deals 260 Trauma damage over 10 seconds"
    	},
    	{
    		id: "power_22203",
    		skill: "Pig",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Squeal boosts sprint speed by 10 for 10 seconds"
    	},
    	{
    		id: "power_22204",
    		skill: "Pig",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Squeal uniformly diminishes all targets' entire aggro lists by 36%, making them less locked in to their aggro choices and more easily susceptible to additional taunts and detaunts"
    	},
    	{
    		id: "power_22251",
    		skill: "Pig",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_PIGHEAL_SENDER}{92}"
    	},
    	{
    		id: "power_22252",
    		skill: "Pig",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Mudbath restores 121 armor to the target"
    	},
    	{
    		id: "power_22253",
    		skill: "Pig",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Mudbath gives the target +12 absorption of any physical damage for 20 seconds"
    	},
    	{
    		id: "power_22254",
    		skill: "Pig",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Mudbath causes the target to take 19% less damage from all attacks for 10 seconds"
    	},
    	{
    		id: "power_22301",
    		skill: "Pig",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Harmlessness heals you for 81 health"
    	},
    	{
    		id: "power_22302",
    		skill: "Pig",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Harmlessness restores 126 armor to you"
    	},
    	{
    		id: "power_22303",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Harmlessness restores 52 power to you"
    	},
    	{
    		id: "power_22304",
    		skill: "Pig",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_1",
    		effect: "Harmlessness confuses the target about which enemy is which, permanently shuffling their hatred levels toward all enemies they know about"
    	},
    	{
    		id: "power_22351",
    		skill: "Pig",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_PIGPUNT}{0.52}"
    	},
    	{
    		id: "power_22352",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Pig Punt deals +35% damage and taunts -240"
    	},
    	{
    		id: "power_22353",
    		skill: "Pig",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Pig Punt causes the target to ignore you for 10 seconds, or until you attack it again"
    	},
    	{
    		id: "power_22354",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Pig Punt has a 35% chance to confuse the target about which enemy is which, permanently shuffling their hatred levels toward all enemies they know about"
    	},
    	{
    		id: "power_22355",
    		skill: "Pig",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Pig Punt deals +20 damage and slows target's movement by 45%"
    	},
    	{
    		id: "power_22401",
    		skill: "Pig",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "For 15 seconds, Frenzy boosts targets' receptivity to Major Heals so that they restore +51 Health"
    	},
    	{
    		id: "power_22402",
    		skill: "Pig",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Frenzy restores 30 power to all targets"
    	},
    	{
    		id: "power_22403",
    		skill: "Pig",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Frenzy gives all targets +11 absorption of any physical damage for 20 seconds"
    	},
    	{
    		id: "power_22404",
    		skill: "Pig",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "For 10 seconds, Frenzy boosts targets' indirect damage +8"
    	},
    	{
    		id: "power_22451",
    		skill: "Pig",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Porcine Alertness gives all targets +39 Accuracy for 20 seconds"
    	},
    	{
    		id: "power_22452",
    		skill: "Pig",
    		slots: [
    			"Ring",
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Porcine Alertness restores 55 armor to all targets"
    	},
    	{
    		id: "power_22453",
    		skill: "Pig",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Porcine Alertness gives all targets +30% chance to ignore Stun effects for 20 seconds"
    	},
    	{
    		id: "power_22454",
    		skill: "Pig",
    		slots: [
    			"Chest",
    			"OffHand",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Porcine Alertness heals all targets for 52 health after a 15 second delay"
    	},
    	{
    		id: "power_23001",
    		skill: "Spider",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_SPIDER}{0.4}"
    	},
    	{
    		id: "power_23002",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{COMBAT_REFRESH_POWER_DELTA}{24}{Spider}"
    	},
    	{
    		id: "power_23003",
    		skill: "Spider",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Premeditated Doom channeling time is -1 second and boosts your Indirect Poison damage +9 (per tick) for 20 seconds"
    	},
    	{
    		id: "power_23004",
    		skill: "Spider",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Spider Bite and Infinite Legs have a 50% chance to deal +40% damage"
    	},
    	{
    		id: "power_23005",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Infinite Legs has a 20% chance to boost Spider Skill Base Damage +10% for 30 seconds"
    	},
    	{
    		id: "power_2301",
    		skill: "FireMagic",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Fire Walls deal +53 damage per hit"
    	},
    	{
    		id: "power_2302",
    		skill: "FireMagic",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Fire Walls have +176 Max Health"
    	},
    	{
    		id: "power_23021",
    		skill: "Spider",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_INJECTVENOM}{0.42}"
    	},
    	{
    		id: "power_23022",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Inject Venom has a 50% chance to deal +85% damage"
    	},
    	{
    		id: "power_23023",
    		skill: "Spider",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Inject Venom heals you for 40 health"
    	},
    	{
    		id: "power_23024",
    		skill: "Spider",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Combo: Gripjaw+Any Spider+Any Spider+Inject Venom: final step deals +54% damage."
    	},
    	{
    		id: "power_23025",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Inject Venom deals +240 Poison damage over 12 seconds"
    	},
    	{
    		id: "power_2303",
    		skill: "FireMagic",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fire Walls' attacks taunt +250%"
    	},
    	{
    		id: "power_2304",
    		skill: "FireMagic",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Molten Veins causes any nearby Fire Walls to recover 117 health"
    	},
    	{
    		id: "power_23101",
    		skill: "Spider",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Web Trap boosts your movement speed by 8 for 10 seconds"
    	},
    	{
    		id: "power_23102",
    		skill: "Spider",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_5",
    		effect: "While you are near your Web Trap, you recover 6 Power per second"
    	},
    	{
    		id: "power_23103",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "While you are near your Web Trap, you recover 11 Health per second"
    	},
    	{
    		id: "power_23104",
    		skill: "Spider",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_RESETTIME_WEBTRAP_DELTA}{-12}"
    	},
    	{
    		id: "power_23201",
    		skill: "Spider",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Gripjaw restores 62 Armor to you"
    	},
    	{
    		id: "power_23202",
    		skill: "Spider",
    		slots: [
    			"Head",
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_GRIPJAW}{121}"
    	},
    	{
    		id: "power_23203",
    		skill: "Spider",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Gripjaw has a 70% chance to deal +87% damage"
    	},
    	{
    		id: "power_23205",
    		skill: "Spider",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Gripjaw deals +32% damage and hastens the current reset timer of Grappling Web by 5 seconds"
    	},
    	{
    		id: "power_23251",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Infinite Legs deals +20% damage and reuse timer is -0.5 second"
    	},
    	{
    		id: "power_23252",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Spider Bite and Infinite Legs restore 16 Health"
    	},
    	{
    		id: "power_23253",
    		skill: "Spider",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_INFINITELEGS}{42}"
    	},
    	{
    		id: "power_23254",
    		skill: "Spider",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "For 12 seconds after using Infinite Legs, additional Infinite Legs attacks deal +28 damage"
    	},
    	{
    		id: "power_23301",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Feet",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Incubated Spiders have +98 health"
    	},
    	{
    		id: "power_23302",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Incubated Spiders have +130 armor"
    	},
    	{
    		id: "power_23303",
    		skill: "Spider",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Incubated Spiders deal +20% direct damage with each attack"
    	},
    	{
    		id: "power_23304",
    		skill: "Spider",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Incubated Spiders have a 66% chance to avoid being hit by burst attacks"
    	},
    	{
    		id: "power_23401",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Spit Acid causes your Signature Debuff abilities to deal +144 damage for 8 seconds"
    	},
    	{
    		id: "power_23402",
    		skill: "Spider",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "While Spider skill is active, gain Direct Poison and Acid Mitigation +48 and Indirect Poison and Acid Mitigation +16"
    	},
    	{
    		id: "power_23403",
    		skill: "Spider",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_POISON_INDIRECT}{0.8}{Spider}"
    	},
    	{
    		id: "power_23451",
    		skill: "Spider",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Spit Acid deals +192 armor damage"
    	},
    	{
    		id: "power_23452",
    		skill: "Spider",
    		slots: [
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Spit Acid deals 270 Acid damage to Health over 12 seconds"
    	},
    	{
    		id: "power_23453",
    		skill: "Spider",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Spit Acid raises your Poison Damage +27% for 30 seconds (this buff does not stack with itself)"
    	},
    	{
    		id: "power_23501",
    		skill: "Spider",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Terrifying Bite boosts sprint speed +8 for 10 seconds"
    	},
    	{
    		id: "power_23502",
    		skill: "Spider",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_TERRIFYINGBITE}{192}"
    	},
    	{
    		id: "power_23503",
    		skill: "Spider",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Terrifying Bite damage +25% and reuse timer is -4.5 seconds"
    	},
    	{
    		id: "power_23504",
    		skill: "Spider",
    		slots: [
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Terrifying Bite causes the target to take +16% damage from Poison attacks"
    	},
    	{
    		id: "power_23505",
    		skill: "Spider",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Terrifying Bite deals 384 Poison damage over 12 seconds"
    	},
    	{
    		id: "power_23551",
    		skill: "Spider",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Premeditated Doom restores 104 health after a 10-second delay"
    	},
    	{
    		id: "power_23552",
    		skill: "Spider",
    		slots: [
    			"Necklace",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Premeditated Doom restores 160 armor after a 10-second delay"
    	},
    	{
    		id: "power_23553",
    		skill: "Spider",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "If you use Premeditated Doom while standing near your Web Trap, you gain +50% Spider Skill Base Damage for 20 seconds"
    	},
    	{
    		id: "power_23554",
    		skill: "Spider",
    		slots: [
    			"Feet",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Premeditated Doom boosts sprint speed +4.5 for 20 seconds"
    	},
    	{
    		id: "power_23601",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_ABILITY_GRAPPLINGWEB}{160}"
    	},
    	{
    		id: "power_23602",
    		skill: "Spider",
    		slots: [
    			"Necklace",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Grappling Web deals 300 Poison damage over 12 seconds"
    	},
    	{
    		id: "power_23603",
    		skill: "Spider",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_1",
    		effect: "After using Grappling Web, you are immune to Knockback effects for 12 seconds"
    	},
    	{
    		id: "power_23604",
    		skill: "Spider",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Grappling Web causes the target to take +16% damage from Poison (both direct and indirect)"
    	},
    	{
    		id: "power_24001",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_GIANTBAT}{0.4}"
    	},
    	{
    		id: "power_24002",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Rip deals +34 damage and restores 11 Power"
    	},
    	{
    		id: "power_24003",
    		skill: "GiantBat",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rip restores 20 Armor"
    	},
    	{
    		id: "power_24004",
    		skill: "GiantBat",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Combo: Rip+Any Melee+Any Giant Bat Attack+Tear: final step hits all targets within 5 meters and deals +85 damage."
    	},
    	{
    		id: "power_24031",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_TEAR}{0.45}"
    	},
    	{
    		id: "power_24032",
    		skill: "GiantBat",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Tear has a 50% chance to deal +100% damage"
    	},
    	{
    		id: "power_24033",
    		skill: "GiantBat",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Tear has a 33% chance to deal +100% damage and reset the timer on Screech (so Screech can be used again immediately)"
    	},
    	{
    		id: "power_24034",
    		skill: "GiantBat",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Tear and Virulent Bite deal +85 damage"
    	},
    	{
    		id: "power_24035",
    		skill: "GiantBat",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rip and Tear deal +33 damage and hasten the current reuse timer of Drink Blood by 1 second"
    	},
    	{
    		id: "power_24061",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_WINGVORTEX}{0.365}"
    	},
    	{
    		id: "power_24062",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Wing Vortex has a 70% chance to deal +25% damage and restore 55 Health to you"
    	},
    	{
    		id: "power_24063",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Wing Vortex has a 30% chance to deal +38% damage and stun all targets"
    	},
    	{
    		id: "power_24064",
    		skill: "GiantBat",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Wing Vortex causes targets' next attack to deal -74 damage"
    	},
    	{
    		id: "power_24091",
    		skill: "GiantBat",
    		slots: [
    			"Legs",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Drink Blood steals 44 additional health"
    	},
    	{
    		id: "power_24092",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Drink Blood deals +136 Piercing damage"
    	},
    	{
    		id: "power_24093",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Drink Blood costs -27 Power"
    	},
    	{
    		id: "power_24094",
    		skill: "GiantBat",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "For 30 seconds after using Drink Blood, all Nature attacks deal +45 damage"
    	},
    	{
    		id: "power_24095",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "For 30 seconds after using Drink Blood, you gain +26 mitigation vs. Psychic and Trauma damage"
    	},
    	{
    		id: "power_24096",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Drink Blood steals 96 more Health over 12 seconds"
    	},
    	{
    		id: "power_24121",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_VIRULENTBITE}{0.49}"
    	},
    	{
    		id: "power_24122",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Virulent Bite deals 192 Trauma damage over 12 seconds and also has a 25% chance to deal +76% immediate Piercing damage"
    	},
    	{
    		id: "power_24123",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Virulent Bite deals 222 Trauma damage to health over 12 seconds"
    	},
    	{
    		id: "power_24124",
    		skill: "GiantBat",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Combo: Screech+Any Giant Bat Attack+Any Melee+Virulent Bite: final step stuns the target and deals +100 damage"
    	},
    	{
    		id: "power_24151",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Bat Stability heals 78 health"
    	},
    	{
    		id: "power_24152",
    		skill: "GiantBat",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_BATSTABILITY_ARMOR_SENDER}{145}"
    	},
    	{
    		id: "power_24153",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Combo: Rip+Any Melee+Any Melee+Bat Stability: final step boosts Giant Bat Base Damage +45% for 10 seconds."
    	},
    	{
    		id: "power_24154",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Bat Stability provides +45% Projectile Evasion for 10 seconds"
    	},
    	{
    		id: "power_24181",
    		skill: "GiantBat",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SCREECH}{0.41}"
    	},
    	{
    		id: "power_24182",
    		skill: "GiantBat",
    		slots: [
    			"Necklace",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Screech has a 60% chance to deal +90% damage"
    	},
    	{
    		id: "power_24183",
    		skill: "GiantBat",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Screech deals +122 damage"
    	},
    	{
    		id: "power_24184",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Screech deals 240 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_24211",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SONICBURST}{0.49}"
    	},
    	{
    		id: "power_24212",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Sonic Burst has a 60% chance to deal +100% damage to all targets"
    	},
    	{
    		id: "power_24213",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Combo: Sonic Burst+Any Giant Bat Attack+Any Ranged Attack+Any Ranged Attack: final step deals +38% damage"
    	},
    	{
    		id: "power_24214",
    		skill: "GiantBat",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Sonic Burst deals 210 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_24241",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Confusing Double heals you for 123 health"
    	},
    	{
    		id: "power_24242",
    		skill: "GiantBat",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Confusing Double boosts your movement speed by 3 and your Giant Bat Base Damage by 40% for 15 seconds"
    	},
    	{
    		id: "power_24243",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_DELTA_CONFUSINGDOUBLE}{-13}"
    	},
    	{
    		id: "power_24244",
    		skill: "GiantBat",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Confusing Double restores 112 Power after a 10 second delay"
    	},
    	{
    		id: "power_24245",
    		skill: "GiantBat",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Your Confusing Double deals +55% damage with each attack"
    	},
    	{
    		id: "power_24246",
    		skill: "GiantBat",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Confusing Double summons an additional figment. Each figment deals +61 damage with each attack"
    	},
    	{
    		id: "power_24247",
    		skill: "GiantBat",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Confusing Double summons an additional figment. Each figment deals +61 damage with each attack"
    	},
    	{
    		id: "power_24281",
    		skill: "GiantBat",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SMOULDERINGGAZE}{0.46}"
    	},
    	{
    		id: "power_24282",
    		skill: "GiantBat",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Deathscream has a 60% chance to deal +100% damage"
    	},
    	{
    		id: "power_24283",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Deathscream deals an additional 594 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_24284",
    		skill: "GiantBat",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Deathscream deals +45% damage and Power cost is -32, but the ability's range is reduced to 12m"
    	},
    	{
    		id: "power_24301",
    		skill: "GiantBat",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_NATURE}{0.32}{GiantBat}"
    	},
    	{
    		id: "power_24302",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MAX_HEALTH}{21}{GiantBat}, {FLY_FASTSPEED_BOOST}{1.5}{GiantBat}"
    	},
    	{
    		id: "power_24303",
    		skill: "GiantBat",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_TRAUMA_INDIRECT}{0.57}{GiantBat}"
    	},
    	{
    		id: "power_24304",
    		skill: "GiantBat",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "If Screech, Sonic Burst, or Deathscream deal Trauma damage, that damage is boosted +75% per tick"
    	},
    	{
    		id: "power_24305",
    		skill: "GiantBat",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Screech, Sonic Burst, and Deathscream deal 256 Nature damage over 8 seconds"
    	},
    	{
    		id: "power_25001",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_RABBIT}{0.4}"
    	},
    	{
    		id: "power_25002",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_4",
    		effect: "{NONCOMBAT_SPRINT_BOOST}{3.5}{Rabbit}"
    	},
    	{
    		id: "power_25003",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{MOD_TRAUMA}{0.4}{Rabbit}"
    	},
    	{
    		id: "power_25004",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_PSYCHIC_INDIRECT}{0.4}{Rabbit}"
    	},
    	{
    		id: "power_25005",
    		skill: "Rabbit",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "{BOOST_COLD_DIRECT}{60}{Rabbit}"
    	},
    	{
    		id: "power_25006",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "While Rabbit skill is active, any Kick ability boosts Melee Evasion +6.5% for 10 seconds"
    	},
    	{
    		id: "power_25011",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Rabbit Scratch deals Trauma damage (instead of Slashing), and deals up to +128 damage (randomly determined)"
    	},
    	{
    		id: "power_25012",
    		skill: "Rabbit",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Rabbit Scratch restores 16 Armor to you"
    	},
    	{
    		id: "power_25021",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_THUMP}{0.46}"
    	},
    	{
    		id: "power_25022",
    		skill: "Rabbit",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Thump deals +31 damage and knocks the enemy backwards"
    	},
    	{
    		id: "power_25023",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Thump causes the target to take +16% damage from Cold attacks for 10 seconds"
    	},
    	{
    		id: "power_25024",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Thump causes 180 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_25051",
    		skill: "Rabbit",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BUNFUKICK}{0.56}"
    	},
    	{
    		id: "power_25052",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_BUNFUKICK_DELAYED}{173}"
    	},
    	{
    		id: "power_25053",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Bun-Fu Blitz causes the target to take +16% damage from Trauma attacks for 20 seconds"
    	},
    	{
    		id: "power_25054",
    		skill: "Rabbit",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Blitz deals +36 damage and hastens the current reset timer of Thump by 3 seconds"
    	},
    	{
    		id: "power_25071",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "Rabbit's Foot grants you and nearby allies +19% Burst Evasion for 10 seconds"
    	},
    	{
    		id: "power_25072",
    		skill: "Rabbit",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Rabbit's Foot grants you and nearby allies +9% Earned Combat XP for 20 seconds"
    	},
    	{
    		id: "power_25073",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Rabbit's Foot restores 28 Power to you and nearby allies"
    	},
    	{
    		id: "power_25074",
    		skill: "Rabbit",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Rabbit's Foot restores 89 Health to you and nearby allies after a 15 second delay"
    	},
    	{
    		id: "power_25101",
    		skill: "Rabbit",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Hare Dash restores 102 Armor to you"
    	},
    	{
    		id: "power_25102",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Hare Dash causes your next attack to deal +235 damage if it is a Crushing attack"
    	},
    	{
    		id: "power_25103",
    		skill: "Rabbit",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Hare Dash grants +12% Melee Evasion for 8 seconds and boosts jump height for 15 seconds"
    	},
    	{
    		id: "power_25104",
    		skill: "Rabbit",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_DELTA_HAREDASH}{-8}"
    	},
    	{
    		id: "power_25105",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Hare Dash restores 80 Power over 15 seconds"
    	},
    	{
    		id: "power_25131",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Play Dead restores 90 Health"
    	},
    	{
    		id: "power_25132",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Play Dead boosts your Psychic attack damage +80 for 20 seconds"
    	},
    	{
    		id: "power_25133",
    		skill: "Rabbit",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Play Dead causes all affected enemies to take 330 Psychic damage after a 10-second delay"
    	},
    	{
    		id: "power_25134",
    		skill: "Rabbit",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Play Dead boosts your Nice Attack Damage +288 for 15 seconds"
    	},
    	{
    		id: "power_25161",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Long Ear grants you +18% Projectile Evasion for 15 seconds"
    	},
    	{
    		id: "power_25162",
    		skill: "Rabbit",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_RESETTIME_DELTA_LONGEAR}{-8}, {ABILITY_RESETTIME_DELTA_PLAYDEAD}{-10}"
    	},
    	{
    		id: "power_25191",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_CARROTPOWER_SENDER}{100}"
    	},
    	{
    		id: "power_25192",
    		skill: "Rabbit",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power restores 240 Health after an 8-second delay"
    	},
    	{
    		id: "power_25193",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power restores 155 Armor"
    	},
    	{
    		id: "power_25194",
    		skill: "Rabbit",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power boosts your Cold Damage +32% for 10 seconds"
    	},
    	{
    		id: "power_25195",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power's reuse timer is -4 seconds and chance to consume carrot is -34%"
    	},
    	{
    		id: "power_25196",
    		skill: "Rabbit",
    		slots: [
    			"Feet",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power boosts the damage from all kicks +192 for 10 seconds"
    	},
    	{
    		id: "power_25197",
    		skill: "Rabbit",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Carrot Power boosts your Crushing Damage +32% for 10 seconds"
    	},
    	{
    		id: "power_25221",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Strike deals +59% damage and reuse time is -1 second"
    	},
    	{
    		id: "power_25222",
    		skill: "Rabbit",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Strike reduces target's rage by 480, then reduces it by 690 more after a 5 second delay"
    	},
    	{
    		id: "power_25223",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Strike deals +20% damage and restores 48 Health to you after an 8 second delay"
    	},
    	{
    		id: "power_25224",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Strike deals +65 damage and hastens the current reset timer of Bun-Fu Kick by 2.5 seconds"
    	},
    	{
    		id: "power_25225",
    		skill: "Rabbit",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Strike deals Cold damage (instead of Crushing), deals +112 damage, and hastens the current reset timer of Bun-Fu Blast by 2 seconds"
    	},
    	{
    		id: "power_25301",
    		skill: "Rabbit",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BUNFUBLAST}{0.52}"
    	},
    	{
    		id: "power_25302",
    		skill: "Rabbit",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Blast deals Cold damage (instead of Psychic), and Ice Magic attacks boost the damage of Bun-Fu Blast by 16% for 60 seconds (max 20 stacks)"
    	},
    	{
    		id: "power_25303",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Blast deals +68 damage and restores 40 Power after a 9-second delay"
    	},
    	{
    		id: "power_25304",
    		skill: "Rabbit",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Bun-Fu Blast deals +96 damage and hastens the current reuse timer of Bun-Fu Strike by 3.5 seconds"
    	},
    	{
    		id: "power_25305",
    		skill: "Rabbit",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "All Bun-Fu moves cost -17 Power"
    	},
    	{
    		id: "power_25351",
    		skill: "Rabbit",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Love Tap lowers target's aggro toward you by 1550"
    	},
    	{
    		id: "power_25352",
    		skill: "Rabbit",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_6",
    		effect: "Love Tap hastens the current reuse timer of Carrot Power by 3.5 seconds"
    	},
    	{
    		id: "power_25353",
    		skill: "Rabbit",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Love Tap deals 335 Trauma damage after an 8-second delay"
    	},
    	{
    		id: "power_25354",
    		skill: "Rabbit",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Love Tap boosts your Melee Evasion +11.5% for 15 seconds"
    	},
    	{
    		id: "power_26001",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_PRIEST}{0.4}"
    	},
    	{
    		id: "power_26005",
    		skill: "Priest",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "{EVASION_CHANCE_BURST}{0.36}{Priest}"
    	},
    	{
    		id: "power_26006",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "If you are using the Priest skill and you have not been attacked in the past 15 seconds, your Power Regeneration is +12 (meaning you recover this Power every 5 seconds, in and out of combat)"
    	},
    	{
    		id: "power_26007",
    		skill: "Priest",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_FIRE_DIRECT}{100}{Priest}"
    	},
    	{
    		id: "power_26011",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "The maximum Power restored by Admonish increases +10"
    	},
    	{
    		id: "power_26012",
    		skill: "Priest",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Admonish boosts your Priest Damage +16 for 10 seconds (this effect does not stack with itself)"
    	},
    	{
    		id: "power_26013",
    		skill: "Priest",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Admonish makes the target 8% more vulnerable to Psychic damage for 10 seconds (this effect does not stack with itself)"
    	},
    	{
    		id: "power_26031",
    		skill: "Priest",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_CASTIGATE}{97}"
    	},
    	{
    		id: "power_26032",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CASTIGATE}{0.47}"
    	},
    	{
    		id: "power_26033",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "When Castigate is used on an undead target, it has a 25% chance to deal +300 damage and stun the target"
    	},
    	{
    		id: "power_26034",
    		skill: "Priest",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Castigate deals Fire damage instead of Psychic, and deals +72% damage to Aberrations"
    	},
    	{
    		id: "power_26035",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Castigate boosts your Nice Attack Damage +96 for 8 seconds"
    	},
    	{
    		id: "power_26051",
    		skill: "Priest",
    		slots: [
    			"MainHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_EXHILARATE_SENDER}{35}"
    	},
    	{
    		id: "power_26052",
    		skill: "Priest",
    		slots: [
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "For 30 seconds after casting Exhilarate on a target, additional Exhilarates on the same target restore +35 Health"
    	},
    	{
    		id: "power_26053",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Exhilarate restores 64 Armor over 8 seconds"
    	},
    	{
    		id: "power_26054",
    		skill: "Priest",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Exhilarate, Triage, and Invigorate restore +47 Health if you haven't been attacked in the past 15 seconds"
    	},
    	{
    		id: "power_26071",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_MENDFLESH_SENDER}{74}"
    	},
    	{
    		id: "power_26072",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_MENDFLESH_ARMOR_SENDER}{110}"
    	},
    	{
    		id: "power_26073",
    		skill: "Priest",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Mend Flesh gives the target +11 mitigation against physical attacks for 12 seconds"
    	},
    	{
    		id: "power_26091",
    		skill: "Priest",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Unfetter grants immunity to Knockback effects for 13 seconds"
    	},
    	{
    		id: "power_26092",
    		skill: "Priest",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Unfetter allows free-form movement while leaping, and if the target can fly, fly speed is boosted +2.4 m/s for 20 seconds"
    	},
    	{
    		id: "power_26093",
    		skill: "Priest",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Unfetter boosts swim speed +3.2 m/s for 20 seconds"
    	},
    	{
    		id: "power_26094",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Unfetter restores 51 Power over 9 seconds"
    	},
    	{
    		id: "power_26111",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_CORRUPTHATE}{235}"
    	},
    	{
    		id: "power_26112",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CORRUPTHATE}{0.9}"
    	},
    	{
    		id: "power_26113",
    		skill: "Priest",
    		slots: [
    			"OffHand",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Corrupt Hate causes the target to deal 288 Psychic damage to themselves the next time they use a Rage attack"
    	},
    	{
    		id: "power_26131",
    		skill: "Priest",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RELENTLESSHOPE_SENDER}{54}"
    	},
    	{
    		id: "power_26132",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RELENTLESSHOPE_POWER_SENDER}{35}"
    	},
    	{
    		id: "power_26133",
    		skill: "Priest",
    		slots: [
    			"MainHand",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RELENTLESSHOPE_ARMOR_SENDER}{85}"
    	},
    	{
    		id: "power_26151",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_RIGHTEOUSFLAME}{153}"
    	},
    	{
    		id: "power_26152",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_RIGHTEOUSFLAME}{0.53}"
    	},
    	{
    		id: "power_26153",
    		skill: "Priest",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Righteous Flame deals +205 Fire damage over 10 seconds"
    	},
    	{
    		id: "power_26171",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_FLAMESTRIKE}{330}"
    	},
    	{
    		id: "power_26172",
    		skill: "Priest",
    		slots: [
    			"OffHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_FLAMESTRIKE}{0.62}"
    	},
    	{
    		id: "power_26173",
    		skill: "Priest",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Flamestrike deals 475 Fire damage over 10 seconds"
    	},
    	{
    		id: "power_26201",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_TRIAGE_SENDER}{45}"
    	},
    	{
    		id: "power_26202",
    		skill: "Priest",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Triage gives the target +26.5% Melee Evasion for 10 seconds"
    	},
    	{
    		id: "power_26203",
    		skill: "Priest",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Triage gives the target +33% Burst Evasion for 10 seconds"
    	},
    	{
    		id: "power_26204",
    		skill: "Priest",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Triage costs no Power to cast and restores +39 Health, but takes +1 second to channel"
    	},
    	{
    		id: "power_26205",
    		skill: "Priest",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Triage restores 80 Health over 15 seconds"
    	},
    	{
    		id: "power_26221",
    		skill: "Priest",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Remedy removes ongoing Fire effects (up to 33 dmg/sec)"
    	},
    	{
    		id: "power_26222",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Remedy restores 66 Armor"
    	},
    	{
    		id: "power_26223",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Remedy restores 20 Armor and mitigates all damage over time by 8 per tick for 10 seconds"
    	},
    	{
    		id: "power_26224",
    		skill: "Priest",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Remedy costs -16 Power to cast, its reuse timer is -1 second, and it has a 25% chance to mend a broken bone in the target"
    	},
    	{
    		id: "power_26241",
    		skill: "Priest",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_INVIGORATE_SENDER}{76}"
    	},
    	{
    		id: "power_26242",
    		skill: "Priest",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_INVIGORATE_ARMOR_SENDER}{112}"
    	},
    	{
    		id: "power_26243",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Invigorate restores +22 Health, Armor, and Power"
    	},
    	{
    		id: "power_26261",
    		skill: "Priest",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Give Warmth restores 63 Health and +17 Body Heat"
    	},
    	{
    		id: "power_26262",
    		skill: "Priest",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Give Warmth causes the target's next attack to deal +208 damage if it is a Fire attack"
    	},
    	{
    		id: "power_26263",
    		skill: "Priest",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Give Warmth boosts the target's fire damage-over-time by +10 per tick for 60 seconds"
    	},
    	{
    		id: "power_27001",
    		skill: "Warden",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_WARDEN}{0.4}"
    	},
    	{
    		id: "power_27011",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_FIRE_INDIRECT}{0.57}{Warden}"
    	},
    	{
    		id: "power_27012",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Indirect Poison and Indirect Trauma damage is +20% per tick while Warden skill active"
    	},
    	{
    		id: "power_27013",
    		skill: "Warden",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Indirect Nature and Indirect Electricity damage is +20% per tick while Warden skill active"
    	},
    	{
    		id: "power_27031",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_8",
    		effect: "Warning Jolt restores 8 Power, and ability range is increased 5 meters"
    	},
    	{
    		id: "power_27032",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Warning Jolt restores 16 Armor and taunts +400"
    	},
    	{
    		id: "power_27033",
    		skill: "Warden",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Warning Jolt restores 16 Armor and boosts the damage of your Core Attacks +49 for 8 seconds"
    	},
    	{
    		id: "power_27051",
    		skill: "Warden",
    		slots: [
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CONDITIONINGSHOCK}{0.46}"
    	},
    	{
    		id: "power_27052",
    		skill: "Warden",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Conditioning Shock deals +66 damage and causes the target to suffer +20% Fire damage for 30 seconds"
    	},
    	{
    		id: "power_27053",
    		skill: "Warden",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Conditioning Shock deals +66 damage and reuse time is 2 seconds sooner"
    	},
    	{
    		id: "power_27054",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Conditioning Shock causes target's next ability to deal -48 damage"
    	},
    	{
    		id: "power_27055",
    		skill: "Warden",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Conditioning Shock deals +68 damage and, if target is a monster, its chance to critically-hit is reduced by 25% for 10 seconds"
    	},
    	{
    		id: "power_27056",
    		skill: "Warden",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Conditioning Shock and Apprehend deal +85 damage"
    	},
    	{
    		id: "power_27071",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_APPREHEND}{0.46}"
    	},
    	{
    		id: "power_27072",
    		skill: "Warden",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Apprehend costs -22 Power"
    	},
    	{
    		id: "power_27073",
    		skill: "Warden",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Apprehend causes your Nice Attacks to deal +112 damage for 8 seconds"
    	},
    	{
    		id: "power_27074",
    		skill: "Warden",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Apprehend deals +80 damage, and damage type is changed to Electricity"
    	},
    	{
    		id: "power_27075",
    		skill: "Warden",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Apprehend deals +40 damage and hastens the current reuse timer of Controlled Burn by 2 seconds (so it can be used again more quickly)"
    	},
    	{
    		id: "power_27091",
    		skill: "Warden",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_LETHALFORCE}{0.43}"
    	},
    	{
    		id: "power_27092",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Lethal Force Damage +160 and Power Cost -32"
    	},
    	{
    		id: "power_27093",
    		skill: "Warden",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Lethal Force deals +208 damage and reuse time is -5 seconds"
    	},
    	{
    		id: "power_27094",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Lethal Force deals 640 additional Fire damage over 8 seconds"
    	},
    	{
    		id: "power_27111",
    		skill: "Warden",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_CONTROLLEDBURN}{0.46}"
    	},
    	{
    		id: "power_27112",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Controlled Burn deals 366 indirect Fire damage over 12 seconds"
    	},
    	{
    		id: "power_27113",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Controlled Burn deals +128 damage and taunts +400 to all targets"
    	},
    	{
    		id: "power_27114",
    		skill: "Warden",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Controlled Burn costs -27 Power"
    	},
    	{
    		id: "power_27115",
    		skill: "Warden",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Controlled Burn and Aggression Deterrent deal +108 damage"
    	},
    	{
    		id: "power_27131",
    		skill: "Warden",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Stun Trap deals +272 damage to all nearby targets (when it activates)"
    	},
    	{
    		id: "power_27132",
    		skill: "Warden",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Stun Trap deals +45% damage to all nearby targets (when it activates)"
    	},
    	{
    		id: "power_27133",
    		skill: "Warden",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Stun Trap reuse timer is 10 seconds faster"
    	},
    	{
    		id: "power_27134",
    		skill: "Warden",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Stun Trap deals +122 damage, and there's a 50% chance you'll place an extra trap"
    	},
    	{
    		id: "power_27135",
    		skill: "Warden",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Stun Trap deals +122 damage, and there's a 50% chance you'll place an extra trap"
    	},
    	{
    		id: "power_27151",
    		skill: "Warden",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Privacy Field deals +53% damage to melee attackers"
    	},
    	{
    		id: "power_27152",
    		skill: "Warden",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Privacy Field deals +61 damage to all melee attackers, and the first melee attacker is knocked away"
    	},
    	{
    		id: "power_27153",
    		skill: "Warden",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Privacy Field causes you to recover 16 Power when a melee attack deals damage to you"
    	},
    	{
    		id: "power_27154",
    		skill: "Warden",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Privacy Field also deals its damage when you are hit by burst attacks, and damage is +70"
    	},
    	{
    		id: "power_27155",
    		skill: "Warden",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Privacy Field also deals its damage when you are hit by ranged attacks, and damage is +55"
    	},
    	{
    		id: "power_27156",
    		skill: "Warden",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "When Privacy Field deals damage, it also ignites the suspect, dealing 156 damage over 12 seconds"
    	},
    	{
    		id: "power_27171",
    		skill: "Warden",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Coordinated Assault causes all allies' Melee attacks to cost -10 Power for 30 seconds"
    	},
    	{
    		id: "power_27172",
    		skill: "Warden",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Coordinated Assault increases all allies' Max Health +45 for 30 seconds"
    	},
    	{
    		id: "power_27173",
    		skill: "Warden",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Coordinated Assault increases all allies' Max Armor +67 for 30 seconds"
    	},
    	{
    		id: "power_27174",
    		skill: "Warden",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Coordinated Assault causes all allies' melee attacks to deal up to +90 damage (randomly determined for each attack) for 30 seconds"
    	},
    	{
    		id: "power_27175",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Coordinated Assault grants all allies +6 direct-damage mitigation and +1.5 out-of-combat sprint speed for 30 seconds"
    	},
    	{
    		id: "power_27191",
    		skill: "Warden",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_AGGRESSIONDETERRENT}{0.43}"
    	},
    	{
    		id: "power_27192",
    		skill: "Warden",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Aggression Deterrent ignites all targets, dealing 260 Fire damage over 8 seconds"
    	},
    	{
    		id: "power_27193",
    		skill: "Warden",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_AGGRESSIONDETERRENT}{-18}"
    	},
    	{
    		id: "power_28001",
    		skill: "SpiritFox",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_SPIRITFOX}{0.4}"
    	},
    	{
    		id: "power_28011",
    		skill: "SpiritFox",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_DARKNESS_DIRECT}{96}{SpiritFox}"
    	},
    	{
    		id: "power_28012",
    		skill: "SpiritFox",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_FIRE_DIRECT}{128}{SpiritFox}"
    	},
    	{
    		id: "power_28013",
    		skill: "SpiritFox",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_FIRE_INDIRECT}{0.42}{SpiritFox}"
    	},
    	{
    		id: "power_28041",
    		skill: "SpiritFox",
    		slots: [
    			"Hands",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Nip causes target's next attack to deal -16 damage"
    	},
    	{
    		id: "power_28042",
    		skill: "SpiritFox",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Nip boosts the damage of Basic, Core, and Nice attacks +80 for 6 seconds. (This buff does not stack with itself.)"
    	},
    	{
    		id: "power_28043",
    		skill: "SpiritFox",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Nip boosts the damage of Basic, Core, and Nice attacks +80 for 6 seconds. (This buff does not stack with itself.)"
    	},
    	{
    		id: "power_28061",
    		skill: "SpiritFox",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SOULBITE}{0.5}"
    	},
    	{
    		id: "power_28062",
    		skill: "SpiritFox",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Soul Bite deals +48 damage and boosts the damage of Nice attacks by +16% for 6 seconds"
    	},
    	{
    		id: "power_28063",
    		skill: "SpiritFox",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Soul Bite deals +37 damage and reduces the damage of the target's next attack by -16"
    	},
    	{
    		id: "power_28064",
    		skill: "SpiritFox",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "While Blur Step is active, Soul Bite has a 33% chance to deal +7 damage and hit all targets within 7 meters"
    	},
    	{
    		id: "power_28065",
    		skill: "SpiritFox",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_SOULBITE}{-31}"
    	},
    	{
    		id: "power_28066",
    		skill: "SpiritFox",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Soul Bite deals Fire damage (instead of Darkness) and damage is +62"
    	},
    	{
    		id: "power_28081",
    		skill: "SpiritFox",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SPIRITPOUNCE}{0.5}"
    	},
    	{
    		id: "power_28082",
    		skill: "SpiritFox",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Spirit Pounce Damage +35% and there's a 50% chance target is Stunned"
    	},
    	{
    		id: "power_28083",
    		skill: "SpiritFox",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Spirit Pounce Damage +70 and target is Knocked Back"
    	},
    	{
    		id: "power_28084",
    		skill: "SpiritFox",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Spirit Pounce Damage +48 and ability hits all enemies within 6 meters"
    	},
    	{
    		id: "power_28101",
    		skill: "SpiritFox",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DIMENSIONALSNARE}{0.9}"
    	},
    	{
    		id: "power_28102",
    		skill: "SpiritFox",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Dimensional Snare Damage +138"
    	},
    	{
    		id: "power_28103",
    		skill: "SpiritFox",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Dimensional Snare causes target to take +9.5% damage from Darkness for 15 seconds"
    	},
    	{
    		id: "power_28104",
    		skill: "SpiritFox",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Dimensional Snare causes target to take +14% damage from Poison for 15 seconds"
    	},
    	{
    		id: "power_28105",
    		skill: "SpiritFox",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Dimensional Snare causes target to take +14% damage from Crushing for 15 seconds"
    	},
    	{
    		id: "power_28106",
    		skill: "SpiritFox",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Dimensional Snare deals Fire damage (instead of Darkness) and ignites the target, dealing 294 Fire damage over 12 seconds"
    	},
    	{
    		id: "power_28121",
    		skill: "SpiritFox",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SPIRITBOLT}{0.55}"
    	},
    	{
    		id: "power_28122",
    		skill: "SpiritFox",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Spirit Bolt Damage +70 and there's a 50% chance target is stunned"
    	},
    	{
    		id: "power_28123",
    		skill: "SpiritFox",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Spirit Bolt Damage +94 and range is +5 meters"
    	},
    	{
    		id: "power_28124",
    		skill: "SpiritFox",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Spirit Bolt deals +96 damage and there's a 50% chance it deals +55% damage"
    	},
    	{
    		id: "power_28125",
    		skill: "SpiritFox",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Spirit Bolt deals Fire damage (instead of Darkness) and ignites the target, dealing 288 Fire damage over 12 seconds"
    	},
    	{
    		id: "power_28141",
    		skill: "SpiritFox",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Power Glyph restores +37 Power"
    	},
    	{
    		id: "power_28142",
    		skill: "SpiritFox",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Power Glyph restores +65 Health"
    	},
    	{
    		id: "power_28143",
    		skill: "SpiritFox",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Power Glyph restores 50 additional Power after a 6-second delay"
    	},
    	{
    		id: "power_28161",
    		skill: "SpiritFox",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Blur Step provides +14.5% Burst Evasion for 20 seconds, and Paradox Trot boosts Sprint Speed +1"
    	},
    	{
    		id: "power_28162",
    		skill: "SpiritFox",
    		slots: [
    			"Feet",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Blur Step provides +14.5% Ranged Evasion for 20 seconds, and Paradox Trot boosts Sprint Speed +1"
    	},
    	{
    		id: "power_28163",
    		skill: "SpiritFox",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Blur Step heals 110 Health over 20 seconds, and Paradox Trot boosts Sprint Speed +1"
    	},
    	{
    		id: "power_28164",
    		skill: "SpiritFox",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Blur Step provides +70% Stun Resistance for 20 seconds, and Paradox Trot boosts Sprint Speed +1"
    	},
    	{
    		id: "power_28181",
    		skill: "SpiritFox",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_GALVANIZE_POWER_SENDER}{53}"
    	},
    	{
    		id: "power_28182",
    		skill: "SpiritFox",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_GALVANIZE_HEALTH_SENDER}{85}"
    	},
    	{
    		id: "power_28183",
    		skill: "SpiritFox",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Galvanize affects the caster in addition to allies, and restores +24 Power"
    	},
    	{
    		id: "power_28184",
    		skill: "SpiritFox",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Power Glyph and Galvanize restore +33 Power"
    	},
    	{
    		id: "power_28185",
    		skill: "SpiritFox",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Galvanize restores 66 additional Power after a 6-second delay"
    	},
    	{
    		id: "power_28201",
    		skill: "SpiritFox",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Trick Foxes have +128 Max Health and Taunt +85%"
    	},
    	{
    		id: "power_28202",
    		skill: "SpiritFox",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Trick Foxes have +128 Max Health and +64 Max Armor"
    	},
    	{
    		id: "power_28203",
    		skill: "SpiritFox",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Trick Foxes have +128 Max Health and their Rage Attacks deal +260 damage"
    	},
    	{
    		id: "power_28221",
    		skill: "SpiritFox",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Paradox Trot boosts Sprint Speed +1, Max Breath +16, and Radiation Protection +9"
    	},
    	{
    		id: "power_3001",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_UNARMED}{0.4}"
    	},
    	{
    		id: "power_3002",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Jab and Infuriating Fist Damage +64"
    	},
    	{
    		id: "power_3003",
    		skill: "Unarmed",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Punch, Jab, and Infuriating Fist restore 18 Health to you"
    	},
    	{
    		id: "power_3004",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_KNEEKICK}{0.44}"
    	},
    	{
    		id: "power_3005",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Unarmed attacks deal +20% damage when you have 33% or less of your Armor left"
    	},
    	{
    		id: "power_3006",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Unarmed attacks deal +32 Armor damage"
    	},
    	{
    		id: "power_3007",
    		skill: "Unarmed",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Unarmed attacks deal +9 damage and have +16 Accuracy (which cancels out the Evasion that certain monsters have)"
    	},
    	{
    		id: "power_3008",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "While Unarmed skill is active: you gain +4% Melee Evasion and any time you Evade a Melee attack you recover 64 Armor"
    	},
    	{
    		id: "power_3009",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "While Unarmed skill is active: any time you Evade an attack, your next attack deals +133 damage"
    	},
    	{
    		id: "power_3010",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "While Unarmed skill is active: 19% of all Slashing, Piercing, and Crushing damage you take is mitigated and added to the damage done by your next Punch, Jab, or Infuriating Fist at a 260% rate"
    	},
    	{
    		id: "power_3011",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "While Unarmed skill is active: 26.5% of all Darkness and Psychic damage you take is mitigated and added to the damage done by your next Punch, Jab, or Infuriating Fist at a 300% rate"
    	},
    	{
    		id: "power_3012",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{TAUNT_MOD}{0.8}{Unarmed}"
    	},
    	{
    		id: "power_3013",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_MAMBASTRIKE}{0.55}"
    	},
    	{
    		id: "power_3014",
    		skill: "Unarmed",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Mamba Strike and Front Kick damage +80"
    	},
    	{
    		id: "power_3021",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_KICK}{62}"
    	},
    	{
    		id: "power_3022",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Kick attacks restore 42 Armor"
    	},
    	{
    		id: "power_3023",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Kick attacks deal +13% damage and grant you 8% Physical Damage Reflection for 15 seconds"
    	},
    	{
    		id: "power_3024",
    		skill: "Unarmed",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_FRONTKICK}{0.4}"
    	},
    	{
    		id: "power_3025",
    		skill: "Unarmed",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Kick attacks deal +18% damage and slow target's movement speed by 45%"
    	},
    	{
    		id: "power_3026",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Kick attacks deal +34% damage when you have 33% or less of your Armor left"
    	},
    	{
    		id: "power_3027",
    		skill: "Unarmed",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "While Unarmed skill active: 21% of all Acid, Poison, and Nature damage you take is mitigated and added to the damage done by your next Kick at a 280% rate"
    	},
    	{
    		id: "power_3041",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Barrage hits all enemies within 5 meters and deals +19% damage, but reuse timer is +3 seconds"
    	},
    	{
    		id: "power_3042",
    		skill: "Unarmed",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Barrage and Headbutt make the target 19% more vulnerable to Psychic damage for 20 seconds (this effect does not stack with itself)"
    	},
    	{
    		id: "power_3043",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Headbutt deals +20% damage and conjures a magical field that mitigates 15% of all physical damage you take for 10 seconds (or until 400 damage is mitigated)"
    	},
    	{
    		id: "power_3044",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BARRAGE}{0.54}"
    	},
    	{
    		id: "power_3045",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Barrage and Headbutt ignite the target, causing them to take 212 Fire damage over 8 seconds"
    	},
    	{
    		id: "power_3046",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Headbutt and Knee Kick Damage +108"
    	},
    	{
    		id: "power_3047",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Barrage costs -14 Power and restores 23 Armor to you"
    	},
    	{
    		id: "power_3048",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEADBUTT}{0.44}"
    	},
    	{
    		id: "power_3081",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HIPTHROW}{0.5}"
    	},
    	{
    		id: "power_3082",
    		skill: "Unarmed",
    		slots: [
    			"Necklace",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Hip Throw deals +226 armor damage"
    	},
    	{
    		id: "power_3083",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Hip Throw and Bodyslam deal +22% damage and generate -390 Rage"
    	},
    	{
    		id: "power_3084",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Hip Throw hits all enemies within 8 meters and deals +16% damage, but Power cost is +20"
    	},
    	{
    		id: "power_3131",
    		skill: "Unarmed",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BODYSLAM}{0.47}"
    	},
    	{
    		id: "power_3132",
    		skill: "Unarmed",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Bodyslam deals +37% damage and slows target's movement speed by 45%"
    	},
    	{
    		id: "power_3133",
    		skill: "Unarmed",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Bruising Blow causes the target to take +24% damage from Poison for 20 seconds"
    	},
    	{
    		id: "power_3134",
    		skill: "Unarmed",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Bodyslam deals +435 damage to non-Elite enemies"
    	},
    	{
    		id: "power_3135",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Bodyslam heals you for 130 health"
    	},
    	{
    		id: "power_3201",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Cobra Strike and Mamba Strike Damage +51%"
    	},
    	{
    		id: "power_3202",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Cobra Strike and Mamba Strike boost your Nice Attack and Signature Debuff ability damage +55 for 7 seconds"
    	},
    	{
    		id: "power_3203",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Cobra Strike and Mamba Strike restore 40 Armor to you"
    	},
    	{
    		id: "power_3251",
    		skill: "Unarmed",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_BRUISINGBLOW}{0.56}"
    	},
    	{
    		id: "power_3252",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Bruising Blow deals +28% damage and hastens the current reuse timer of Bodyslam by 5 seconds"
    	},
    	{
    		id: "power_3253",
    		skill: "Unarmed",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bruising Blow and Headbutt restore 28 Health"
    	},
    	{
    		id: "power_3254",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Bruising Blow deals Trauma damage instead of Crushing, and targets suffer +12.5% damage from other Trauma attacks for 20 seconds"
    	},
    	{
    		id: "power_3301",
    		skill: "Unarmed",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_SLASHINGSTRIKE}{0.31}"
    	},
    	{
    		id: "power_3302",
    		skill: "Unarmed",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Slashing Strike deals +126 Trauma damage over 6 seconds"
    	},
    	{
    		id: "power_3303",
    		skill: "Unarmed",
    		slots: [
    			"OffHand",
    			"Head"
    		],
    		tierId: "id_10",
    		effect: "Slashing Strike and Claw Barrage boost damage from Epic attacks +74 for 10 seconds"
    	},
    	{
    		id: "power_3304",
    		skill: "Unarmed",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_10",
    		effect: "Slashing Strike deals +15% damage and hastens the current reuse timer of Hip Throw by 2.5 seconds"
    	},
    	{
    		id: "power_3351",
    		skill: "Unarmed",
    		slots: [
    			"Feet",
    			"OffHand"
    		],
    		tierId: "id_2",
    		effect: "{IGNORE_CHANCE_KNOCKBACK}{0.3}{Unarmed}"
    	},
    	{
    		id: "power_3401",
    		skill: "Unarmed",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_10",
    		effect: "Infuriating Fist deals +40% damage and taunts +400"
    	},
    	{
    		id: "power_3402",
    		skill: "Unarmed",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_10",
    		effect: "Infuriating Fist taunts +460 and deals 150 Trauma damage over 6 seconds"
    	},
    	{
    		id: "power_3403",
    		skill: "Unarmed",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_10",
    		effect: "Infuriating Fist generates no Rage and instead reduces Rage by 650"
    	},
    	{
    		id: "power_3404",
    		skill: "Unarmed",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_10",
    		effect: "Infuriating Fist damage +103. Damage becomes Trauma instead of Crushing"
    	},
    	{
    		id: "power_4001",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_PSYCHOLOGY}{0.4}"
    	},
    	{
    		id: "power_4002",
    		skill: "Psychology",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze deals between 160 and 360 extra damage"
    	},
    	{
    		id: "power_4003",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze restores 115 Health to you after a 15 second delay"
    	},
    	{
    		id: "power_4004",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze restores 172 Armor to you"
    	},
    	{
    		id: "power_4005",
    		skill: "Psychology",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze causes the target to be worth 16% more XP if slain within 60 seconds"
    	},
    	{
    		id: "power_4006",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze causes the target to take +20 damage from Psychic attacks for 60 seconds"
    	},
    	{
    		id: "power_4007",
    		skill: "Psychology",
    		slots: [
    			"Legs",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_PEPTALK_DELTA}{-4.5}"
    	},
    	{
    		id: "power_4008",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Soothe, But I Love You, and Cause Terror Damage +70"
    	},
    	{
    		id: "power_4009",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_CRITICAL_HIT_DAMAGE}{1.8}{Psychology}"
    	},
    	{
    		id: "power_4031",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Psychoanalyze, Tell Me About Your Mother, and You Were Adopted Damage +113"
    	},
    	{
    		id: "power_4032",
    		skill: "Psychology",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Mock deals +105% damage and taunts +400, but reuse timer is +2 seconds"
    	},
    	{
    		id: "power_4033",
    		skill: "Psychology",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_11",
    		effect: "Soothe further reduces target's Rage by 950"
    	},
    	{
    		id: "power_4034",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Tell Me About Your Mother restores 141 Armor to you"
    	},
    	{
    		id: "power_4035",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Tell Me About Your Mother causes target's attacks to deal -20 damage for 60 seconds"
    	},
    	{
    		id: "power_4036",
    		skill: "Psychology",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_11",
    		effect: "Tell Me About Your Mother boosts your Epic Attack Damage +110 and reduces the Power cost of your Epic Attacks -19 for 15 seconds"
    	},
    	{
    		id: "power_4061",
    		skill: "Psychology",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_STRIKEANERVE}{0.38}"
    	},
    	{
    		id: "power_4062",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Strike a Nerve deals between 48 and 160 extra damage"
    	},
    	{
    		id: "power_4063",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Strike a Nerve deals +132 armor damage"
    	},
    	{
    		id: "power_4064",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Strike a Nerve generates no Rage and instead reduces Rage by 490"
    	},
    	{
    		id: "power_4065",
    		skill: "Psychology",
    		slots: [
    			"Waist"
    		],
    		tierId: "id_1",
    		effect: "Strike a Nerve Damage +65 (this treasure effect is retired and is using a placeholder buff)"
    	},
    	{
    		id: "power_4066",
    		skill: "Psychology",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Mock and Ridicule deal +45 damage and taunt +160"
    	},
    	{
    		id: "power_4081",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_PEPTALK_SENDER}{106}"
    	},
    	{
    		id: "power_4082",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Pep Talk restores 47 Power"
    	},
    	{
    		id: "power_4083",
    		skill: "Psychology",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Pep Talk removes ongoing Poison effects (up to 44 dmg/sec)"
    	},
    	{
    		id: "power_4084",
    		skill: "Psychology",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Pep Talk removes ongoing Fire effects (up to 48 dmg/sec)"
    	},
    	{
    		id: "power_4085",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Pep Talk restores 112 Armor"
    	},
    	{
    		id: "power_4111",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_5",
    		effect: "Fast Talk taunts -300 and reduces Rage by 500"
    	},
    	{
    		id: "power_4112",
    		skill: "Psychology",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Fast Talk heals you for 37 health"
    	},
    	{
    		id: "power_4113",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Fast Talk heals you for 58 armor"
    	},
    	{
    		id: "power_4201",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_1",
    		effect: "Positive Attitude boosts your Out-of-Combat Sprint Speed by 4 for 60 seconds"
    	},
    	{
    		id: "power_4202",
    		skill: "Psychology",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Positive Attitude increases your Poison Mitigation +16 for 30 seconds"
    	},
    	{
    		id: "power_4203",
    		skill: "Psychology",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Positive Attitude increases your Core Attack Damage +98 for 15 seconds"
    	},
    	{
    		id: "power_4204",
    		skill: "Psychology",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_DELTA_POSITIVEATTITUDE}{-14}"
    	},
    	{
    		id: "power_4301",
    		skill: "Psychology",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_INSPIRECONFIDENCE_SENDER}{63}"
    	},
    	{
    		id: "power_4302",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Inspire Confidence increases all targets' Accuracy +16 for 10 seconds"
    	},
    	{
    		id: "power_4303",
    		skill: "Psychology",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_12",
    		effect: "Inspire Confidence increases the damage of all targets' attacks +12 for 30 seconds"
    	},
    	{
    		id: "power_4304",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Inspire Confidence restores +119 Health after a 15 second delay"
    	},
    	{
    		id: "power_4305",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Inspire Confidence restores +165 Health after a 25 second delay"
    	},
    	{
    		id: "power_4401",
    		skill: "Psychology",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "But I Love You deals +20% damage and stuns the target"
    	},
    	{
    		id: "power_4402",
    		skill: "Psychology",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "But I Love You boosts your Nice and Epic Attack Damage +75 for 8 seconds"
    	},
    	{
    		id: "power_4431",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "You Were Adopted deals +40% damage and Power cost is -18"
    	},
    	{
    		id: "power_4432",
    		skill: "Psychology",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_YOUWEREADOPTED}{0.55}"
    	},
    	{
    		id: "power_4433",
    		skill: "Psychology",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "You Were Adopted deals +33% damage and triggers the target's Vulnerability"
    	},
    	{
    		id: "power_4471",
    		skill: "Psychology",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_CAUSETERROR}{174}"
    	},
    	{
    		id: "power_4472",
    		skill: "Psychology",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Cause Terror deals +70 damage, costs -17 Power, and reuse timer is -6 seconds"
    	},
    	{
    		id: "power_4501",
    		skill: "Psychology",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_SOOTHE}{100}"
    	},
    	{
    		id: "power_4502",
    		skill: "Psychology",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_11",
    		effect: "Soothe boosts the healing from your Major Healing abilities +44 for 10 seconds"
    	},
    	{
    		id: "power_4531",
    		skill: "Psychology",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Ridicule deals +45 health damage and taunts +425"
    	},
    	{
    		id: "power_4532",
    		skill: "Psychology",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Ridicule boosts movement speed by 4.5 for 6 seconds"
    	},
    	{
    		id: "power_5001",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_STAFF}{0.4}"
    	},
    	{
    		id: "power_5002",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{COMBAT_REFRESH_ARMOR_DELTA}{55}{Staff}"
    	},
    	{
    		id: "power_5003",
    		skill: "Staff",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Smash, Double Hit, and Heed The Stick Damage +125"
    	},
    	{
    		id: "power_5004",
    		skill: "Staff",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_NICEATTACK}{-30}{Staff}"
    	},
    	{
    		id: "power_5005",
    		skill: "Staff",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "All Staff attacks have a 5.5% chance to trigger the target's Vulnerability"
    	},
    	{
    		id: "power_5006",
    		skill: "Staff",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Phoenix Strike costs -16 Power and boosts your Direct Fire Damage +20% for 30 seconds"
    	},
    	{
    		id: "power_5007",
    		skill: "Staff",
    		slots: [
    			"Ring",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Double Hit causes your next attack to deal +100 damage if it is a Crushing attack"
    	},
    	{
    		id: "power_5008",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Pin heals you for 45 health"
    	},
    	{
    		id: "power_5009",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Pin boosts Core Attack and Nice Attack Damage +98 for 15 seconds"
    	},
    	{
    		id: "power_5010",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Suppress and Heed the Stick have +35 Accuracy"
    	},
    	{
    		id: "power_5031",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DOUBLEHIT}{0.29}"
    	},
    	{
    		id: "power_5032",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Necklace"
    		],
    		tierId: "id_10",
    		effect: "{MOD_ABILITY_PHOENIXSTRIKE}{0.6}"
    	},
    	{
    		id: "power_5033",
    		skill: "Staff",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_10",
    		effect: "Phoenix Strike deals +41% Fire damage to melee attackers, and ability reuse timer is -7 seconds"
    	},
    	{
    		id: "power_5034",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_10",
    		effect: "Phoenix Strike deals +189 Fire damage to melee attackers"
    	},
    	{
    		id: "power_5035",
    		skill: "Staff",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Double Hit costs -16 Power and makes the target 10% more vulnerable to direct Fire and Cold damage for 8 seconds"
    	},
    	{
    		id: "power_5036",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Headcracker and Strategic Thrust deal +22% damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_5037",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Suppress and Deflective Spin Damage +37%"
    	},
    	{
    		id: "power_5038",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Double Hit ignites the target, dealing 198 Fire damage over 12 seconds"
    	},
    	{
    		id: "power_5039",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Blocking Stance boosts your Cold Damage +6.75% for 30 seconds"
    	},
    	{
    		id: "power_5040",
    		skill: "Staff",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Double Hit deals +36% damage and hastens the current reuse timer of Headcracker by 2 seconds"
    	},
    	{
    		id: "power_5061",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Lunge deals +43% damage to health and armor"
    	},
    	{
    		id: "power_5062",
    		skill: "Staff",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Lunge hits all enemies within 7 meters and deals +175 damage to health and armor, but reuse timer is +2 seconds"
    	},
    	{
    		id: "power_5063",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Redirect causes target to bleed, dealing 448 Trauma damage over 8 seconds"
    	},
    	{
    		id: "power_5065",
    		skill: "Staff",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Lunge deals +63 damage and knocks the target backwards"
    	},
    	{
    		id: "power_5066",
    		skill: "Staff",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Lunge causes the next attack that hits you to deal 29 less damage"
    	},
    	{
    		id: "power_5091",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Deflective Spin heals 270 Health over 15 seconds"
    	},
    	{
    		id: "power_5092",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Deflective Spin costs -9 Power and mitigates +11 damage from each attack for 15 seconds"
    	},
    	{
    		id: "power_5093",
    		skill: "Staff",
    		slots: [
    			"Feet",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Deflective Spin restores 66 Health instantly and provides +50 Mitigation from all Elite attacks for 15 seconds"
    	},
    	{
    		id: "power_5094",
    		skill: "Staff",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Deflective Spin gives you +18% Projectile Evasion for 15 seconds"
    	},
    	{
    		id: "power_5121",
    		skill: "Staff",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Pin deals +120 damage and has +25 Accuracy (which cancels out the Evasion that certain monsters have)"
    	},
    	{
    		id: "power_5122",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Blocking Stance costs -16 Power and mitigates +10% of physical damage from Elite attackers for 30 seconds"
    	},
    	{
    		id: "power_5123",
    		skill: "Staff",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Blocking Stance boosts your Psychic Damage +6.75% for 30 seconds"
    	},
    	{
    		id: "power_5124",
    		skill: "Staff",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "For 60 seconds after using Blocking Stance, First Aid heals you +68"
    	},
    	{
    		id: "power_5125",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Blocking Stance mitigates +12 physical damage (Crushing, Slashing, Piercing) for 30 seconds. Against Elite enemies, mitigates +24 more"
    	},
    	{
    		id: "power_5151",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_REDIRECT}{1}"
    	},
    	{
    		id: "power_5152",
    		skill: "Staff",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_11",
    		effect: "For 60 seconds after using Redirect, First Aid heals you +75"
    	},
    	{
    		id: "power_5153",
    		skill: "Staff",
    		slots: [
    			"Ring",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Redirect generates no Rage, reduces Rage by 1160, and taunts -780"
    	},
    	{
    		id: "power_5154",
    		skill: "Staff",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Redirect deals +60 damage and stuns the target"
    	},
    	{
    		id: "power_5201",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Strategic Thrust deals +48% damage, plus 40% more damage if the target is Vulnerable"
    	},
    	{
    		id: "power_5202",
    		skill: "Staff",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Strategic Thrust and Lunge Damage +31%"
    	},
    	{
    		id: "power_5203",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "If Strategic Thrust is used on a Vulnerable target, it deals +113 damage and restores 80 Health to you"
    	},
    	{
    		id: "power_5251",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEEDTHESTICK}{0.61}"
    	},
    	{
    		id: "power_5252",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Heed The Stick deals +16% Damage and Taunts +960"
    	},
    	{
    		id: "power_5253",
    		skill: "Staff",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Heed The Stick heals you for 28 health (or armor if health is full)"
    	},
    	{
    		id: "power_5254",
    		skill: "Staff",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_11",
    		effect: "Heed The Stick gives you +17 mitigation from direct attacks for 10 seconds"
    	},
    	{
    		id: "power_5301",
    		skill: "Staff",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_HEADCRACKER}{0.6}"
    	},
    	{
    		id: "power_5302",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Headcracker deals +100 damage, generates no Rage, and reduces Rage by 192"
    	},
    	{
    		id: "power_5303",
    		skill: "Staff",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_11",
    		effect: "After using Headcracker, you take -50% damage from Psychic attacks for 15 seconds"
    	},
    	{
    		id: "power_5351",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_PIN}{0.6}"
    	},
    	{
    		id: "power_5352",
    		skill: "Staff",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Pin generates no Rage and reduces Rage by 900"
    	},
    	{
    		id: "power_5353",
    		skill: "Staff",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_11",
    		effect: "Pin causes target's attacks to deal -50% damage for 5 seconds"
    	},
    	{
    		id: "power_5401",
    		skill: "Staff",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_10",
    		effect: "For 30 seconds after using Phoenix Strike, your Survival Utility and Major Heal abilities restore 83 Health to you"
    	},
    	{
    		id: "power_5402",
    		skill: "Staff",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_1",
    		effect: "Phoenix Strike deals +10% damage and triggers the target's Vulnerability"
    	},
    	{
    		id: "power_5434",
    		skill: "Staff",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Suppress heals you for 45 health"
    	},
    	{
    		id: "power_5451",
    		skill: "Staff",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SUPPRESS}{0.48}"
    	},
    	{
    		id: "power_5452",
    		skill: "Staff",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Suppress deals +32% damage and causes targets to lose an additional 400 Rage"
    	},
    	{
    		id: "power_5453",
    		skill: "Staff",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Combo: Suppress+Any Melee+Any Melee+Headcracker: final step stuns the target while dealing +200 damage."
    	},
    	{
    		id: "power_6001",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_WEREWOLF}{0.4}"
    	},
    	{
    		id: "power_6002",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Werewolf Bite deals +19% damage and boosts your Nice Attack Damage +50 for 10 seconds"
    	},
    	{
    		id: "power_6003",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Claw and Double Claw restore 18 Health"
    	},
    	{
    		id: "power_6004",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{TAUNT_MOD}{-0.275}{Werewolf}"
    	},
    	{
    		id: "power_6005",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_TRAUMA}{0.56}{Werewolf}"
    	},
    	{
    		id: "power_6031",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_WEREWOLFBITE}{0.36}"
    	},
    	{
    		id: "power_6032",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MAX_HEALTH}{35}{Werewolf}"
    	},
    	{
    		id: "power_6033",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bite restores 30 Health to you"
    	},
    	{
    		id: "power_6034",
    		skill: "Werewolf",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Werewolf Bite hits all enemies within 5 meters and deals +16% damage, but reuse timer is +2 seconds"
    	},
    	{
    		id: "power_6035",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Skulk boosts the damage of your Core and Nice Attacks +50 for 30 seconds"
    	},
    	{
    		id: "power_6081",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_POUNCINGRAKE}{121}"
    	},
    	{
    		id: "power_6082",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Double Claw Damage +88"
    	},
    	{
    		id: "power_6083",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Pouncing Rake deals +172 Armor damage"
    	},
    	{
    		id: "power_6084",
    		skill: "Werewolf",
    		slots: [
    			"Necklace",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Werewolf Claw, Double Claw, and Pouncing Rake Damage +50"
    	},
    	{
    		id: "power_6085",
    		skill: "Werewolf",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_POUNCINGRAKE}{0.44}"
    	},
    	{
    		id: "power_6086",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DOUBLECLAW}{0.34}"
    	},
    	{
    		id: "power_6087",
    		skill: "Werewolf",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_DOUBLECLAW}{-17}"
    	},
    	{
    		id: "power_6088",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Blood of the Pack restores 90 Health over 10 seconds to you and your allies"
    	},
    	{
    		id: "power_6111",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_PACKATTACK}{0.41}"
    	},
    	{
    		id: "power_6112",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Future Pack Attacks to the same target deal +80 damage"
    	},
    	{
    		id: "power_6113",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "After using Pack Attack, your Lycanthropy Base Damage increases +85% for 7 seconds or until you are attacked"
    	},
    	{
    		id: "power_6114",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Bite, Pack Attack, and Smell Fear Damage +24%"
    	},
    	{
    		id: "power_6115",
    		skill: "Werewolf",
    		slots: [
    			"Feet",
    			"MainHand"
    		],
    		tierId: "id_11",
    		effect: "Blood of the Pack causes you and your allies' attacks to deal +35 damage for 30 seconds"
    	},
    	{
    		id: "power_6131",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SANGUINEFANGS}{0.63}"
    	},
    	{
    		id: "power_6132",
    		skill: "Werewolf",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Sanguine Fangs deals +224 trauma damage over 8 seconds"
    	},
    	{
    		id: "power_6133",
    		skill: "Werewolf",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Sanguine Fangs causes the target to take +12% damage from Slashing attacks for 15 seconds"
    	},
    	{
    		id: "power_6134",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Sanguine Fangs suddenly deals 280 Trauma damage after an 8-second delay"
    	},
    	{
    		id: "power_6135",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Sanguine Fangs deals +29% Crushing damage and doesn't cause the target to yell for help"
    	},
    	{
    		id: "power_6151",
    		skill: "Werewolf",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "See Red heals you for 38 health"
    	},
    	{
    		id: "power_6152",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "See Red deals +36 damage and Power cost is -16"
    	},
    	{
    		id: "power_6153",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "For 8 seconds after using See Red, all other Lycanthropy attacks deal 116 Trauma damage over 8 seconds"
    	},
    	{
    		id: "power_6154",
    		skill: "Werewolf",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "See Red increases the damage of your next attack by +95"
    	},
    	{
    		id: "power_6155",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "See Red grants you 14% melee evasion for 8 seconds"
    	},
    	{
    		id: "power_6171",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SMELLFEAR}{0.55}"
    	},
    	{
    		id: "power_6172",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Smell Fear deals +27% damage and further reduces Rage by 400"
    	},
    	{
    		id: "power_6173",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_BLOODOFTHEPACK_SENDER}{85}"
    	},
    	{
    		id: "power_6174",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Smell Fear deals +36% damage and taunts -480"
    	},
    	{
    		id: "power_6175",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_11",
    		effect: "Skulk grants you +24 Mitigation against all attacks"
    	},
    	{
    		id: "power_6176",
    		skill: "Werewolf",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_11",
    		effect: "Blood of the Pack restores +71 Health to you and costs -12 Power"
    	},
    	{
    		id: "power_6201",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_WEREWOLFMETABOLISM_HEALTHREGEN}{16}"
    	},
    	{
    		id: "power_6202",
    		skill: "Werewolf",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_9",
    		effect: "{BOOST_WEREWOLFMETABOLISM_POWERREGEN}{9}"
    	},
    	{
    		id: "power_6301",
    		skill: "Werewolf",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Shadow Feint raises your Lycanthropy Base Damage +52% until you trigger the teleport"
    	},
    	{
    		id: "power_6302",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Shadow Feint causes your next attack to deal +192 damage if it is a Werewolf ability"
    	},
    	{
    		id: "power_6303",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "When you teleport via Shadow Feint, you recover 83 Armor and your Sprint Speed is +3 for 10 seconds"
    	},
    	{
    		id: "power_6304",
    		skill: "Werewolf",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "When you teleport via Shadow Feint, you recover 100 Health"
    	},
    	{
    		id: "power_6305",
    		skill: "Werewolf",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Shadow Feint reduces the taunt of all your attacks by 46% until you trigger the teleport"
    	},
    	{
    		id: "power_6306",
    		skill: "Werewolf",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "When Skulk is used, you recover 52 Health and all enemies within 10 meters are taunted -700"
    	},
    	{
    		id: "power_6307",
    		skill: "Werewolf",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_11",
    		effect: "Skulk causes your next attack to deal +43% damage if it is a Crushing attack"
    	},
    	{
    		id: "power_6308",
    		skill: "Werewolf",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_11",
    		effect: "Skulk grants you +70% Projectile Evasion"
    	},
    	{
    		id: "power_7001",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_BATTLECHEMISTRY}{0.4}"
    	},
    	{
    		id: "power_7002",
    		skill: "BattleChemistry",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_BOMB}{96}"
    	},
    	{
    		id: "power_7003",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_TOXINBOMB}{0.45}"
    	},
    	{
    		id: "power_7004",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_MYCOTOXINBOMB}{0.52}"
    	},
    	{
    		id: "power_7005",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_ACIDBOMB}{0.43}"
    	},
    	{
    		id: "power_7021",
    		skill: "BattleChemistry",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Toxic Irritant boosts your Nice Attack Damage +50 for 8 seconds"
    	},
    	{
    		id: "power_7101",
    		skill: "BattleChemistry",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_ABILITY_FREEZINGMIST}{0.87}"
    	},
    	{
    		id: "power_7102",
    		skill: "BattleChemistry",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Freezing Mist restores 133 Armor to you"
    	},
    	{
    		id: "power_7201",
    		skill: "BattleChemistry",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Healing Mist heals +82 Health"
    	},
    	{
    		id: "power_7202",
    		skill: "BattleChemistry",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Healing Mist heals +118 Armor"
    	},
    	{
    		id: "power_7203",
    		skill: "BattleChemistry",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "All bomb attacks ignite the target, causing them to take 140 fire damage over 10 seconds"
    	},
    	{
    		id: "power_7204",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_HEALINGINJECTION_SENDER}{70}"
    	},
    	{
    		id: "power_7205",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Healing Mist restores 40 power"
    	},
    	{
    		id: "power_7206",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Healing Injection heals 90 Health after a 20 second delay"
    	},
    	{
    		id: "power_7207",
    		skill: "BattleChemistry",
    		slots: [
    			"Legs",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Bomb attacks deal +55 damage and hasten the current reuse timer of Healing Mist by 2.5 seconds"
    	},
    	{
    		id: "power_7208",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_1",
    		effect: "Healing Mist hastens the remaining reset timer of Pep Talk by 10 seconds (if Pep Talk is not already ready to use)"
    	},
    	{
    		id: "power_7209",
    		skill: "BattleChemistry",
    		slots: [
    			"Head"
    		],
    		tierId: "id_1",
    		effect: "Healing Mist hastens the remaining reset timer of Reconstruct by 10 seconds (if Reconstruct is not already ready to use)"
    	},
    	{
    		id: "power_7210",
    		skill: "BattleChemistry",
    		slots: [
    			"Ring"
    		],
    		tierId: "id_1",
    		effect: "Healing Mist hastens the remaining reset timer of Regrowth by 10 seconds (if Regrowth is not already ready to use)"
    	},
    	{
    		id: "power_7211",
    		skill: "BattleChemistry",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "You heal 22 health every other second while under the effect of Haste Concoction"
    	},
    	{
    		id: "power_7212",
    		skill: "BattleChemistry",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "You heal 16 health and 16 armor every other second while under the effect of Haste Concoction"
    	},
    	{
    		id: "power_7213",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands",
    			"Chest"
    		],
    		tierId: "id_8",
    		effect: "You regain 8 Power every other second while under the effect of Haste Concoction"
    	},
    	{
    		id: "power_7301",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Taunting Punch deals +80 damage"
    	},
    	{
    		id: "power_7302",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Legs",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Poison Bomb deals +66 damage"
    	},
    	{
    		id: "power_7303",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands",
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Self Destruct deals +270 damage"
    	},
    	{
    		id: "power_7304",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Rage Acid Toss deals +195 damage"
    	},
    	{
    		id: "power_7305",
    		skill: "BattleChemistry",
    		slots: [
    			"Ring",
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Doom Admixture deals +260 damage"
    	},
    	{
    		id: "power_7306",
    		skill: "BattleChemistry",
    		slots: [
    			"Necklace",
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Healing Mist heals +40 health"
    	},
    	{
    		id: "power_7307",
    		skill: "BattleChemistry",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Invigorating Mist heals 46 health"
    	},
    	{
    		id: "power_7308",
    		skill: "BattleChemistry",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Rage Mist and Self Sacrifice abilities heal +68 health"
    	},
    	{
    		id: "power_7309",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Healing Injection heals +21 health"
    	},
    	{
    		id: "power_7310",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Your golem minion's Fire Balm heals +48 health"
    	},
    	{
    		id: "power_7401",
    		skill: "BattleChemistry",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Your Knee Spikes mutation also causes kicks to restore 18 Health to the kicker"
    	},
    	{
    		id: "power_7402",
    		skill: "BattleChemistry",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Your Knee Spikes mutation causes kicks to deal an additional +20% damage"
    	},
    	{
    		id: "power_7431",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Your Extra Skin mutation causes the target to heal 55 Health every 20 seconds"
    	},
    	{
    		id: "power_7432",
    		skill: "BattleChemistry",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Your Extra Skin mutation provides +18 mitigation from Slashing attacks"
    	},
    	{
    		id: "power_7433",
    		skill: "BattleChemistry",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Your Extra Skin mutation provides +18 mitigation from Piercing attacks"
    	},
    	{
    		id: "power_7471",
    		skill: "BattleChemistry",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Your Extra Heart mutation causes the target to regain +35 Power every 20 seconds"
    	},
    	{
    		id: "power_7472",
    		skill: "BattleChemistry",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Your Extra Heart and Stretchy Spine mutations grant the target +55 Max Health"
    	},
    	{
    		id: "power_7491",
    		skill: "BattleChemistry",
    		slots: [
    			"Chest"
    		],
    		tierId: "id_1",
    		effect: "Your Stretchy Spine mutation randomly repairs broken bones twice as often"
    	},
    	{
    		id: "power_8001",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_NECROMANCY}{0.4}"
    	},
    	{
    		id: "power_8002",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Death's Hold ignites the target, dealing 228 Fire damage over 12 seconds"
    	},
    	{
    		id: "power_8003",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Spark of Death deals +49 damage and renders target 10% more vulnerable to Electricity damage for 30 seconds"
    	},
    	{
    		id: "power_8004",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Summoned Skeletons deal +17% direct damage"
    	},
    	{
    		id: "power_8005",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Life Steal restores 34 Health"
    	},
    	{
    		id: "power_8006",
    		skill: "Necromancy",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Life Steal targets all enemies within 10 meters and steals +32 health, but reuse timer is +3 seconds and Power cost is +23"
    	},
    	{
    		id: "power_8007",
    		skill: "Necromancy",
    		slots: [
    			"Legs",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Life Steal reaps 35 additional health"
    	},
    	{
    		id: "power_8008",
    		skill: "Necromancy",
    		slots: [
    			"Necklace",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Life Steal deals 220 Psychic damage over 10 seconds"
    	},
    	{
    		id: "power_8021",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Deathgaze deals +95% damage and has +20 Accuracy (which cancels out the Evasion that certain monsters have)"
    	},
    	{
    		id: "power_8022",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Deathgaze deals +84 damage and restores 83 armor to you"
    	},
    	{
    		id: "power_8023",
    		skill: "Necromancy",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Deathgaze deals +118 damage and increases your sprint speed +2.5 for 15 seconds"
    	},
    	{
    		id: "power_8041",
    		skill: "Necromancy",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_DEATHSHOLD}{0.98}"
    	},
    	{
    		id: "power_8042",
    		skill: "Necromancy",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Death's Hold causes target to take +14% damage from Slashing for 15 seconds"
    	},
    	{
    		id: "power_8043",
    		skill: "Necromancy",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Death's Hold causes target to take +14% damage from Electricity for 15 seconds"
    	},
    	{
    		id: "power_8044",
    		skill: "Necromancy",
    		slots: [
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Death's Hold causes target to take +9.5% damage from Darkness for 15 seconds"
    	},
    	{
    		id: "power_8061",
    		skill: "Necromancy",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SPARKOFDEATH}{0.4}"
    	},
    	{
    		id: "power_8062",
    		skill: "Necromancy",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Spark of Death deals 180 Psychic damage over 12 seconds"
    	},
    	{
    		id: "power_8063",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Spark of Death deals +28% damage and taunts +360"
    	},
    	{
    		id: "power_8101",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_UNDEADHEAL_SENDER}{71}"
    	},
    	{
    		id: "power_8102",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Rebuild Undead restores 55 Health to you"
    	},
    	{
    		id: "power_8103",
    		skill: "Necromancy",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Rebuild Undead restores 110 health/armor to your undead after a 10 second delay"
    	},
    	{
    		id: "power_8104",
    		skill: "Necromancy",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_REBUILDUNDEAD}{-35}"
    	},
    	{
    		id: "power_8201",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Using Raise Zombie on an existing zombie increases its damage +34% for 60 seconds"
    	},
    	{
    		id: "power_8202",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_PSYCHIC_INDIRECT}{0.4}{Necromancy}"
    	},
    	{
    		id: "power_8251",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_WAVEOFDARKNESS}{0.44}"
    	},
    	{
    		id: "power_8252",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Wave of Darkness deals 228 Psychic damage over 12 seconds"
    	},
    	{
    		id: "power_8253",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Wave of Darkness deals +83 damage and reuse timer is -1 second"
    	},
    	{
    		id: "power_8254",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Wave of Darkness deals +160 damage to sentient creatures"
    	},
    	{
    		id: "power_8301",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Summoned Skeletons have +50 health"
    	},
    	{
    		id: "power_8302",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Summoned Skeletons have +76 armor"
    	},
    	{
    		id: "power_8303",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Summoned Skeletal Archers and Mages deal +28 direct damage"
    	},
    	{
    		id: "power_8304",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Summoned Skeletal Swordsmen have +108 armor"
    	},
    	{
    		id: "power_8305",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Using Raise Zombie on an existing zombie increases its damage +48 for 5 minutes (this effect stacks with itself)"
    	},
    	{
    		id: "power_8306",
    		skill: "Necromancy",
    		slots: [
    			"MainHand",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Provoke Undead causes your minions to deal +25% damage for 10 seconds, but also take 135 damage over 10 seconds"
    	},
    	{
    		id: "power_8307",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Provoke Undead causes your minions to deal +35 damage for 10 seconds"
    	},
    	{
    		id: "power_8308",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Summoned Skeletal Swordsmen taunt as if they did 850% more damage"
    	},
    	{
    		id: "power_8309",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Deathgaze deals +104 damage and reuse timer is -3 seconds"
    	},
    	{
    		id: "power_8310",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{MOD_FIRE_INDIRECT}{0.4}{Necromancy}"
    	},
    	{
    		id: "power_8311",
    		skill: "Necromancy",
    		slots: [
    			"Chest",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Using Raise Zombie on an existing zombie raises its Max Health +155 for 60 seconds (and heals +155)"
    	},
    	{
    		id: "power_8312",
    		skill: "Necromancy",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Summoned Skeletal Swordsmen have -45% Max Rage, allowing them to use their stun attack more often"
    	},
    	{
    		id: "power_8313",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Provoke Undead restores 52 Health to you and causes your attacks to taunt +20% for 10 seconds"
    	},
    	{
    		id: "power_8314",
    		skill: "Necromancy",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Provoke Undead deals 57 damage to your minions, who then deal +50 damage for 10 seconds"
    	},
    	{
    		id: "power_8315",
    		skill: "Necromancy",
    		slots: [
    			"Head",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "Heal Undead and Rebuild Undead restore +26 Health/Armor"
    	},
    	{
    		id: "power_8316",
    		skill: "Necromancy",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Heal Undead restores +18 health/armor and grants target undead +13 Mitigation from all attacks for 8 seconds"
    	},
    	{
    		id: "power_8317",
    		skill: "Necromancy",
    		slots: [
    			"OffHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Heal Undead restores +24 Health/Armor and boosts your next attack +43 if it is a Darkness attack"
    	},
    	{
    		id: "power_8318",
    		skill: "Necromancy",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Heal Undead restores +20 and has a 25% chance to boost targets' mitigation +35 for 8 seconds"
    	},
    	{
    		id: "power_8319",
    		skill: "Necromancy",
    		slots: [
    			"Ring",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Summoned Skeletons deal +18% direct damage, but take +150% more damage from any cold attacks"
    	},
    	{
    		id: "power_8320",
    		skill: "Necromancy",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Heart's Power has a 28% chance to not actually consume the heart(s)"
    	},
    	{
    		id: "power_8321",
    		skill: "Necromancy",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Summoned Skeletal Archers and Mages deal +20% direct damage, but take +50% damage from any slashing, piercing, or crushing attacks"
    	},
    	{
    		id: "power_8322",
    		skill: "Necromancy",
    		slots: [
    			"Head"
    		],
    		tierId: "id_8",
    		effect: "Summoned Skeletal Archers and Mages deal +13% direct damage, but are instantly destroyed by ANY Nature Damage"
    	},
    	{
    		id: "power_8351",
    		skill: "Necromancy",
    		slots: [
    			"Hands",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Raised Zombies deal +21% damage"
    	},
    	{
    		id: "power_8352",
    		skill: "Necromancy",
    		slots: [
    			"Necklace",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Raised Zombies deal +39 damage and taunt as if they did +200% more damage"
    	},
    	{
    		id: "power_8353",
    		skill: "Necromancy",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Raised Zombies deal +20 damage and speed is +10"
    	},
    	{
    		id: "power_9001",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{MOD_SKILL_MENTALISM}{0.4}"
    	},
    	{
    		id: "power_9002",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "All Psi Wave Abilities cost -14 Power and your Combat Refresh restores +28 Health"
    	},
    	{
    		id: "power_9003",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Mindreave deals +36 damage and deals Electricity damage instead of Psychic"
    	},
    	{
    		id: "power_9004",
    		skill: "Mentalism",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Electrify stuns the target and deals +32 damage"
    	},
    	{
    		id: "power_9005",
    		skill: "Mentalism",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Electrify, System Shock, and Panic Charge restore 30 Health after a 15 second delay"
    	},
    	{
    		id: "power_9006",
    		skill: "Mentalism",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_TAUNT_DELTA_MINDREAVE}{-380}"
    	},
    	{
    		id: "power_9007",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Agonize deals +576 Psychic damage over 12 seconds"
    	},
    	{
    		id: "power_9008",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "For 15 seconds after using Mindreave, your Major Healing abilities restore +48 Health (this effect does not stack with itself)"
    	},
    	{
    		id: "power_9009",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "{MOD_CRITICAL_HIT_DAMAGE}{1.6}{Mentalism}"
    	},
    	{
    		id: "power_9010",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{ABILITY_COST_DELTA_PAINBUBBLE}{-38}"
    	},
    	{
    		id: "power_9031",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_SYSTEMSHOCK}{0.39}"
    	},
    	{
    		id: "power_9032",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"OffHand",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "System Shock deals +48 Electricity damage plus 186 Trauma damage over 12 seconds"
    	},
    	{
    		id: "power_9033",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "System Shock deals +36 damage, generates no Rage, and reduces Rage by 330"
    	},
    	{
    		id: "power_9034",
    		skill: "Mentalism",
    		slots: [
    			"MainHand",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "System Shock boosts the damage of your Signature Debuffs by +92 for 6 seconds"
    	},
    	{
    		id: "power_9035",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "System Shock restores 44 Armor to you"
    	},
    	{
    		id: "power_9081",
    		skill: "Mentalism",
    		slots: [
    			"OffHand",
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_RECONSTRUCT_SENDER}{96}"
    	},
    	{
    		id: "power_9082",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"MainHand",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_REVITALIZE_SENDER}{48}"
    	},
    	{
    		id: "power_9083",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Reconstruct restores +23 Health and causes the target to take 24 less damage from attacks for 10 seconds"
    	},
    	{
    		id: "power_9084",
    		skill: "Mentalism",
    		slots: [
    			"Hands",
    			"Feet"
    		],
    		tierId: "id_8",
    		effect: "Revitalize restores +22 Health and causes the target to take 30 less damage from Psychic and Nature attacks for 10 seconds"
    	},
    	{
    		id: "power_9085",
    		skill: "Mentalism",
    		slots: [
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "Reconstruct restores 51 Power to the target"
    	},
    	{
    		id: "power_9086",
    		skill: "Mentalism",
    		slots: [
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Revitalize restores +20 Health and removes ongoing Trauma effects (up to 26 dmg/sec)"
    	},
    	{
    		id: "power_9087",
    		skill: "Mentalism",
    		slots: [
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Reconstruct restores 35 power and boosts target's sprint speed by 4.5 for 10 seconds"
    	},
    	{
    		id: "power_9088",
    		skill: "Mentalism",
    		slots: [
    			"Necklace",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Revitalize restores 67 armor to YOU (regardless of the target of the ability)"
    	},
    	{
    		id: "power_9301",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Psi Health Wave and Psi Adrenaline Wave instantly heal all targets for 32 health"
    	},
    	{
    		id: "power_9302",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Psi Health Wave heals all targets for 74 health after a 25 second delay"
    	},
    	{
    		id: "power_9303",
    		skill: "Mentalism",
    		slots: [
    			"Hands",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Psi Health Wave and Psi Armor Wave instantly heal you for 47 health"
    	},
    	{
    		id: "power_9304",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Ring"
    		],
    		tierId: "id_8",
    		effect: "Psi Health Wave grants all targets +28 Mitigation vs. Electricity, Acid, and Nature attacks for 20 seconds"
    	},
    	{
    		id: "power_9305",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Health Wave, Armor Wave, and Power Wave restore +8 Health, Armor, and Power respectively every few seconds"
    	},
    	{
    		id: "power_9401",
    		skill: "Mentalism",
    		slots: [
    			"Hands",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Psi Armor Wave instantly restores 52 armor to all targets"
    	},
    	{
    		id: "power_9402",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_16",
    		effect: "Psi Armor Wave and Psi Adrenaline Wave restore 158 armor to all targets after a 25 second delay"
    	},
    	{
    		id: "power_9403",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "Psi Health Wave and Psi Armor Wave instantly restore 84 armor to you"
    	},
    	{
    		id: "power_9404",
    		skill: "Mentalism",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Agonize deals +22% damage and conjures a magical field that mitigates 20% of all physical damage you take for 1 minute (or until 200 damage is mitigated)."
    	},
    	{
    		id: "power_9405",
    		skill: "Mentalism",
    		slots: [
    			"Hands",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MAX_POWER}{40}{Mentalism}"
    	},
    	{
    		id: "power_9501",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Psi Power Wave and Psi Adrenaline Wave restore 54 power to all targets after a 25 second delay"
    	},
    	{
    		id: "power_9502",
    		skill: "Mentalism",
    		slots: [
    			"Head",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Psi Power Wave instantly restores 31 power to all targets"
    	},
    	{
    		id: "power_9503",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Power Wave and Psi Adrenaline Wave instantly restore 32 power to you"
    	},
    	{
    		id: "power_9504",
    		skill: "Mentalism",
    		slots: [
    			"Hands"
    		],
    		tierId: "id_8",
    		effect: "Psi Power Wave and Psi Armor Wave cause all targets' melee attacks to cost -8 Power for 20 seconds"
    	},
    	{
    		id: "power_9505",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"OffHand"
    		],
    		tierId: "id_8",
    		effect: "{MAX_HEALTH}{67}{Mentalism}"
    	},
    	{
    		id: "power_9601",
    		skill: "Mentalism",
    		slots: [
    			"Legs",
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Health Wave, Armor Wave, and Power Wave grant all targets +42 Psychic Damage for 60 seconds"
    	},
    	{
    		id: "power_9602",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Adrenaline Wave increases all targets' Slashing damage +9% for 20 seconds"
    	},
    	{
    		id: "power_9603",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Adrenaline Wave increases all targets' Electricity damage +9% for 20 seconds"
    	},
    	{
    		id: "power_9604",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Psi Adrenaline Wave increases all targets' Crushing damage +9% for 20 seconds"
    	},
    	{
    		id: "power_9605",
    		skill: "Mentalism",
    		slots: [
    			"MainHand"
    		],
    		tierId: "id_8",
    		effect: "Agonize deals +70% damage and reuse timer is -11 seconds, but the ability deals 120 health damage to YOU"
    	},
    	{
    		id: "power_9606",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_AGONIZE}{0.67}"
    	},
    	{
    		id: "power_9701",
    		skill: "Mentalism",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_PANICCHARGE}{1}"
    	},
    	{
    		id: "power_9702",
    		skill: "Mentalism",
    		slots: [
    			"Ring",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "Panic Charge boosts the damage of all your attacks +23 for 20 seconds"
    	},
    	{
    		id: "power_9703",
    		skill: "Mentalism",
    		slots: [
    			"Feet",
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Panic Charge knocks all targets back and restores 78 armor to you"
    	},
    	{
    		id: "power_9751",
    		skill: "Mentalism",
    		slots: [
    			"MainHand",
    			"Legs"
    		],
    		tierId: "id_16",
    		effect: "{MOD_ABILITY_ELECTRIFY}{0.45}"
    	},
    	{
    		id: "power_9752",
    		skill: "Mentalism",
    		slots: [
    			"Chest",
    			"Hands"
    		],
    		tierId: "id_16",
    		effect: "Pain Bubble deals +80 damage and restores 60 armor to you"
    	},
    	{
    		id: "power_9753",
    		skill: "Mentalism",
    		slots: [
    			"Necklace",
    			"Chest"
    		],
    		tierId: "id_16",
    		effect: "Electrify generates no rage and removes 1200 Rage"
    	},
    	{
    		id: "power_9754",
    		skill: "Mentalism",
    		slots: [
    			"Feet",
    			"Ring"
    		],
    		tierId: "id_16",
    		effect: "Electrify restores 64 Health to you"
    	},
    	{
    		id: "power_9755",
    		skill: "Mentalism",
    		slots: [
    			"MainHand",
    			"Necklace"
    		],
    		tierId: "id_8",
    		effect: "{ABILITY_RESETTIME_RECONSTRUCT_DELTA}{-4.5}"
    	},
    	{
    		id: "power_9756",
    		skill: "Mentalism",
    		slots: [
    			"Head"
    		],
    		tierId: "id_16",
    		effect: "Electrify restores 40 power to you"
    	},
    	{
    		id: "power_9801",
    		skill: "Mentalism",
    		slots: [
    			"Necklace",
    			"OffHand"
    		],
    		tierId: "id_16",
    		effect: "{BOOST_ABILITY_PAINBUBBLE}{192}"
    	},
    	{
    		id: "power_9802",
    		skill: "Mentalism",
    		slots: [
    			"Ring",
    			"Feet"
    		],
    		tierId: "id_16",
    		effect: "Pain Bubble increases the damage of your ranged attacks by 13% for 10 seconds"
    	}
    ];
    var data = {
    	abilities: abilities,
    	items: items,
    	skills: skills,
    	itemMods: itemMods
    };

    /* src/App.svelte generated by Svelte v3.37.0 */

    const { Object: Object_1, console: console_1, window: window_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i];
    	child_ctx[22] = list;
    	child_ctx[23] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	return child_ctx;
    }

    function get_each_context_6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	return child_ctx;
    }

    // (112:3) {#each data.skills as skill}
    function create_each_block_6(ctx) {
    	let option;
    	let t0_value = /*skill*/ ctx[33].name + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = /*skill*/ ctx[33].name;
    			option.value = option.__value;
    			add_location(option, file, 112, 4, 3388);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_6.name,
    		type: "each",
    		source: "(112:3) {#each data.skills as skill}",
    		ctx
    	});

    	return block;
    }

    // (118:2) {#if state.skill1}
    function create_if_block_5(ctx) {
    	let each_1_anchor;
    	let each_value_5 = data.abilities;
    	validate_each_argument(each_value_5);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_5.length; i += 1) {
    		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state, updateHash*/ 10) {
    				each_value_5 = data.abilities;
    				validate_each_argument(each_value_5);
    				let i;

    				for (i = 0; i < each_value_5.length; i += 1) {
    					const child_ctx = get_each_context_5(ctx, each_value_5, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_5.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(118:2) {#if state.skill1}",
    		ctx
    	});

    	return block;
    }

    // (120:4) {#if ability.skill === state.skill1}
    function create_if_block_6(ctx) {
    	let label;
    	let input;
    	let t0;
    	let t1_value = /*ability*/ ctx[30].name + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			attr_dev(input, "type", "checkbox");
    			input.__value = /*ability*/ ctx[30].internalName;
    			input.value = input.__value;
    			/*$$binding_groups*/ ctx[10][1].push(input);
    			add_location(input, file, 121, 6, 3589);
    			add_location(label, file, 120, 5, 3575);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = ~/*state*/ ctx[1].skill1Abilities.indexOf(input.__value);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_handler*/ ctx[9]),
    					listen_dev(input, "change", /*updateHash*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state*/ 2) {
    				input.checked = ~/*state*/ ctx[1].skill1Abilities.indexOf(input.__value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			/*$$binding_groups*/ ctx[10][1].splice(/*$$binding_groups*/ ctx[10][1].indexOf(input), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(120:4) {#if ability.skill === state.skill1}",
    		ctx
    	});

    	return block;
    }

    // (119:3) {#each data.abilities as ability}
    function create_each_block_5(ctx) {
    	let if_block_anchor;
    	let if_block = /*ability*/ ctx[30].skill === /*state*/ ctx[1].skill1 && create_if_block_6(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*ability*/ ctx[30].skill === /*state*/ ctx[1].skill1) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_6(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_5.name,
    		type: "each",
    		source: "(119:3) {#each data.abilities as ability}",
    		ctx
    	});

    	return block;
    }

    // (133:3) {#each data.skills as skill}
    function create_each_block_4(ctx) {
    	let option;
    	let t0_value = /*skill*/ ctx[33].name + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = /*skill*/ ctx[33].name;
    			option.value = option.__value;
    			add_location(option, file, 133, 4, 3944);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(133:3) {#each data.skills as skill}",
    		ctx
    	});

    	return block;
    }

    // (139:2) {#if state.skill2}
    function create_if_block_3(ctx) {
    	let each_1_anchor;
    	let each_value_3 = data.abilities;
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state, updateHash*/ 10) {
    				each_value_3 = data.abilities;
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(139:2) {#if state.skill2}",
    		ctx
    	});

    	return block;
    }

    // (141:4) {#if ability.skill === state.skill2}
    function create_if_block_4(ctx) {
    	let label;
    	let input;
    	let t0;
    	let t1_value = /*ability*/ ctx[30].name + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			attr_dev(input, "type", "checkbox");
    			input.__value = /*ability*/ ctx[30].internalName;
    			input.value = input.__value;
    			/*$$binding_groups*/ ctx[10][0].push(input);
    			add_location(input, file, 142, 6, 4145);
    			add_location(label, file, 141, 5, 4131);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = ~/*state*/ ctx[1].skill2Abilities.indexOf(input.__value);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_handler_1*/ ctx[13]),
    					listen_dev(input, "change", /*updateHash*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state*/ 2) {
    				input.checked = ~/*state*/ ctx[1].skill2Abilities.indexOf(input.__value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			/*$$binding_groups*/ ctx[10][0].splice(/*$$binding_groups*/ ctx[10][0].indexOf(input), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(141:4) {#if ability.skill === state.skill2}",
    		ctx
    	});

    	return block;
    }

    // (140:3) {#each data.abilities as ability}
    function create_each_block_3(ctx) {
    	let if_block_anchor;
    	let if_block = /*ability*/ ctx[30].skill === /*state*/ ctx[1].skill2 && create_if_block_4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*ability*/ ctx[30].skill === /*state*/ ctx[1].skill2) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(140:3) {#each data.abilities as ability}",
    		ctx
    	});

    	return block;
    }

    // (156:6) {#if item.slot === slot.name}
    function create_if_block_2(ctx) {
    	let option;
    	let t0_value = /*item*/ ctx[27].name + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = /*item*/ ctx[27].id;
    			option.value = option.__value;
    			add_location(option, file, 156, 7, 4542);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(156:6) {#if item.slot === slot.name}",
    		ctx
    	});

    	return block;
    }

    // (155:5) {#each data.items as item}
    function create_each_block_2(ctx) {
    	let if_block_anchor;
    	let if_block = /*item*/ ctx[27].slot === /*slot*/ ctx[21].name && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*item*/ ctx[27].slot === /*slot*/ ctx[21].name) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(155:5) {#each data.items as item}",
    		ctx
    	});

    	return block;
    }

    // (164:5) {#if mod.skill === state.skill1 || mod.skill === state.skill2}
    function create_if_block(ctx) {
    	let show_if = /*mod*/ ctx[24].slots.includes(/*slot*/ ctx[21].name);
    	let if_block_anchor;
    	let if_block = show_if && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state*/ 2) show_if = /*mod*/ ctx[24].slots.includes(/*slot*/ ctx[21].name);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(164:5) {#if mod.skill === state.skill1 || mod.skill === state.skill2}",
    		ctx
    	});

    	return block;
    }

    // (165:6) {#if mod.slots.includes(slot.name)}
    function create_if_block_1(ctx) {
    	let label;
    	let input;
    	let t0;
    	let t1_value = /*mod*/ ctx[24].effect + "";
    	let t1;
    	let mounted;
    	let dispose;

    	function change_handler_2(...args) {
    		return /*change_handler_2*/ ctx[15](/*mod*/ ctx[24], ...args);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(t1_value);
    			attr_dev(input, "type", "checkbox");
    			input.value = /*mod*/ ctx[24].id;
    			add_location(input, file, 166, 8, 4809);
    			add_location(label, file, 165, 7, 4793);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			append_dev(label, t0);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", change_handler_2, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(165:6) {#if mod.slots.includes(slot.name)}",
    		ctx
    	});

    	return block;
    }

    // (163:4) {#each data.itemMods as mod}
    function create_each_block_1(ctx) {
    	let if_block_anchor;
    	let if_block = (/*mod*/ ctx[24].skill === /*state*/ ctx[1].skill1 || /*mod*/ ctx[24].skill === /*state*/ ctx[1].skill2) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*mod*/ ctx[24].skill === /*state*/ ctx[1].skill1 || /*mod*/ ctx[24].skill === /*state*/ ctx[1].skill2) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(163:4) {#each data.itemMods as mod}",
    		ctx
    	});

    	return block;
    }

    // (151:2) {#each state.slots as slot, slotIndex}
    function create_each_block(ctx) {
    	let div;
    	let h3;
    	let t0_value = /*slot*/ ctx[21].name + "";
    	let t0;
    	let t1;
    	let select;
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;
    	let each_value_2 = data.items;
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[14].call(select, /*each_value*/ ctx[22], /*slotIndex*/ ctx[23]);
    	}

    	let each_value_1 = data.itemMods;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			add_location(h3, file, 152, 4, 4387);
    			if (/*slot*/ ctx[21].item === void 0) add_render_callback(select_change_handler);
    			add_location(select, file, 153, 4, 4412);
    			add_location(div, file, 151, 3, 4377);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, select);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select, null);
    			}

    			select_option(select, /*slot*/ ctx[21].item);
    			append_dev(div, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "change", select_change_handler),
    					listen_dev(select, "change", /*updateHash*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*state*/ 2 && t0_value !== (t0_value = /*slot*/ ctx[21].name + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*state*/ 2) {
    				each_value_2 = data.items;
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty[0] & /*state*/ 2) {
    				select_option(select, /*slot*/ ctx[21].item);
    			}

    			if (dirty[0] & /*itemModChange, updateHash, state*/ 42) {
    				each_value_1 = data.itemMods;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t3);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(151:2) {#each state.slots as slot, slotIndex}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let div0;
    	let h30;
    	let t3;
    	let select0;
    	let option0;
    	let t5;
    	let t6;
    	let div1;
    	let h31;
    	let t8;
    	let select1;
    	let option1;
    	let t10;
    	let t11;
    	let div2;
    	let t12;
    	let div3;
    	let t13;
    	let input;
    	let t14;
    	let button;
    	let t16;
    	let textarea;
    	let mounted;
    	let dispose;
    	let each_value_6 = data.skills;
    	validate_each_argument(each_value_6);
    	let each_blocks_2 = [];

    	for (let i = 0; i < each_value_6.length; i += 1) {
    		each_blocks_2[i] = create_each_block_6(get_each_context_6(ctx, each_value_6, i));
    	}

    	let if_block0 = /*state*/ ctx[1].skill1 && create_if_block_5(ctx);
    	let each_value_4 = data.skills;
    	validate_each_argument(each_value_4);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks_1[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	let if_block1 = /*state*/ ctx[1].skill2 && create_if_block_3(ctx);
    	let each_value = /*state*/ ctx[1].slots;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "pgsim";
    			t1 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Skill 1";
    			t3 = space();
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "None";

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].c();
    			}

    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Skill 2";
    			t8 = space();
    			select1 = element("select");
    			option1 = element("option");
    			option1.textContent = "None";

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t10 = space();
    			if (if_block1) if_block1.c();
    			t11 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t12 = space();
    			div3 = element("div");
    			t13 = text("Sim length: ");
    			input = element("input");
    			t14 = space();
    			button = element("button");
    			button.textContent = "Run Simulation";
    			t16 = space();
    			textarea = element("textarea");
    			add_location(h1, file, 106, 1, 3199);
    			add_location(h30, file, 108, 2, 3223);
    			option0.__value = "None";
    			option0.value = option0.__value;
    			add_location(option0, file, 110, 3, 3330);
    			if (/*state*/ ctx[1].skill1 === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[7].call(select0));
    			add_location(select0, file, 109, 2, 3242);
    			add_location(div0, file, 107, 1, 3215);
    			add_location(h31, file, 129, 2, 3779);
    			option1.__value = "None";
    			option1.value = option1.__value;
    			add_location(option1, file, 131, 3, 3886);
    			if (/*state*/ ctx[1].skill2 === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[11].call(select1));
    			add_location(select1, file, 130, 2, 3798);
    			add_location(div1, file, 128, 1, 3771);
    			add_location(div2, file, 149, 1, 4327);
    			add_location(input, file, 176, 14, 5024);
    			add_location(button, file, 177, 2, 5086);
    			add_location(div3, file, 175, 1, 5004);
    			attr_dev(textarea, "class", "report svelte-meehst");
    			add_location(textarea, file, 179, 1, 5142);
    			attr_dev(main, "class", "svelte-meehst");
    			add_location(main, file, 105, 0, 3191);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, select0);
    			append_dev(select0, option0);

    			for (let i = 0; i < each_blocks_2.length; i += 1) {
    				each_blocks_2[i].m(select0, null);
    			}

    			select_option(select0, /*state*/ ctx[1].skill1);
    			append_dev(div0, t5);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(main, t6);
    			append_dev(main, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t8);
    			append_dev(div1, select1);
    			append_dev(select1, option1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select1, null);
    			}

    			select_option(select1, /*state*/ ctx[1].skill2);
    			append_dev(div1, t10);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(main, t11);
    			append_dev(main, div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(main, t12);
    			append_dev(main, div3);
    			append_dev(div3, t13);
    			append_dev(div3, input);
    			set_input_value(input, /*state*/ ctx[1].simLength);
    			append_dev(div3, t14);
    			append_dev(div3, button);
    			append_dev(main, t16);
    			append_dev(main, textarea);
    			set_input_value(textarea, /*report*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "hashchange", /*hashchange*/ ctx[2], false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[7]),
    					listen_dev(select0, "change", /*change_handler*/ ctx[8], false, false, false),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[11]),
    					listen_dev(select1, "change", /*change_handler_1*/ ctx[12], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[16]),
    					listen_dev(input, "change", /*updateHash*/ ctx[3], false, false, false),
    					listen_dev(button, "click", /*run*/ ctx[6], false, false, false),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 0) {
    				each_value_6 = data.skills;
    				validate_each_argument(each_value_6);
    				let i;

    				for (i = 0; i < each_value_6.length; i += 1) {
    					const child_ctx = get_each_context_6(ctx, each_value_6, i);

    					if (each_blocks_2[i]) {
    						each_blocks_2[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_2[i] = create_each_block_6(child_ctx);
    						each_blocks_2[i].c();
    						each_blocks_2[i].m(select0, null);
    					}
    				}

    				for (; i < each_blocks_2.length; i += 1) {
    					each_blocks_2[i].d(1);
    				}

    				each_blocks_2.length = each_value_6.length;
    			}

    			if (dirty[0] & /*state*/ 2) {
    				select_option(select0, /*state*/ ctx[1].skill1);
    			}

    			if (/*state*/ ctx[1].skill1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*data*/ 0) {
    				each_value_4 = data.skills;
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_4(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_4.length;
    			}

    			if (dirty[0] & /*state*/ 2) {
    				select_option(select1, /*state*/ ctx[1].skill2);
    			}

    			if (/*state*/ ctx[1].skill2) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*itemModChange, updateHash, state*/ 42) {
    				each_value = /*state*/ ctx[1].slots;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*state*/ 2 && input.value !== /*state*/ ctx[1].simLength) {
    				set_input_value(input, /*state*/ ctx[1].simLength);
    			}

    			if (dirty[0] & /*report*/ 1) {
    				set_input_value(textarea, /*report*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_2, detaching);
    			if (if_block0) if_block0.d();
    			destroy_each(each_blocks_1, detaching);
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let report;
    	let processNextHashChange = true;

    	let state = {
    		skill1: "",
    		skill1Abilities: [],
    		skill2: "",
    		skill2Abilities: [],
    		slots: [],
    		itemMods: {},
    		simLength: 30
    	};

    	const foundSlots = [];

    	for (const item of data.items) {
    		if (!foundSlots.includes(item.slot)) {
    			foundSlots.push(item.slot);
    			state.slots.push({ name: item.slot });
    		}
    	}

    	// Check for hash on initial load
    	if (window.location.hash !== "") {
    		hashchange();
    	}

    	function hashchange() {
    		if (processNextHashChange && window.location.hash !== "") {
    			const hash = window.location.hash.substring(1);

    			try {
    				let stateFromHash = JSON.parse(atob(hash));
    				$$invalidate(1, state = stateFromHash);
    			} catch(e) {
    				console.log("Invalid state from hash", hash);
    			}
    		} else {
    			processNextHashChange = true;
    		}
    	}

    	function updateHash() {
    		processNextHashChange = false;
    		window.location.hash = btoa(JSON.stringify(state));
    	}

    	function skillChanged() {
    		$$invalidate(1, state.itemMods = {}, state);
    	}

    	function itemModChange(e, mod) {
    		const checked = e.target.checked;

    		if (checked) {
    			$$invalidate(1, state.itemMods[mod.id] = mod.tierId, state);
    		} else {
    			delete state.itemMods[mod.id];
    		}
    	}

    	function run() {
    		return __awaiter(this, void 0, void 0, function* () {
    			// Get simulation length
    			let simLength = 30;

    			if (!isNaN(Number(state.simLength))) {
    				simLength = Number(state.simLength);
    			}

    			// Get equipped items
    			let items = [];

    			for (const slot of state.slots) {
    				if (slot.item) {
    					items.push(slot.item);
    				}
    			}

    			// Get equipped item mods
    			let itemMods = [];

    			for (const [modId, tierId] of Object.entries(state.itemMods)) {
    				itemMods.push([modId, tierId]);
    			}

    			let configJson = {
    				abilities: state.skill1Abilities.concat(state.skill2Abilities),
    				items,
    				itemMods,
    				simLength
    			};

    			console.log("Run sim", configJson);

    			const fetchResponse = yield fetch(`/api/v1/sim`, {
    				method: "POST",
    				body: JSON.stringify(configJson),
    				headers: { "Content-Type": "application/json" }
    			});

    			$$invalidate(0, report = yield fetchResponse.text());
    		});
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[], []];

    	function select0_change_handler() {
    		state.skill1 = select_value(this);
    		$$invalidate(1, state);
    	}

    	const change_handler = () => {
    		skillChanged();
    		updateHash();
    	};

    	function input_change_handler() {
    		state.skill1Abilities = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(1, state);
    	}

    	function select1_change_handler() {
    		state.skill2 = select_value(this);
    		$$invalidate(1, state);
    	}

    	const change_handler_1 = () => {
    		skillChanged();
    		updateHash();
    	};

    	function input_change_handler_1() {
    		state.skill2Abilities = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, state);
    	}

    	function select_change_handler(each_value, slotIndex) {
    		each_value[slotIndex].item = select_value(this);
    		$$invalidate(1, state);
    	}

    	const change_handler_2 = (mod, e) => {
    		itemModChange(e, mod);
    		updateHash();
    	};

    	function input_input_handler() {
    		state.simLength = this.value;
    		$$invalidate(1, state);
    	}

    	function textarea_input_handler() {
    		report = this.value;
    		$$invalidate(0, report);
    	}

    	$$self.$capture_state = () => ({
    		__awaiter,
    		data,
    		report,
    		processNextHashChange,
    		state,
    		foundSlots,
    		hashchange,
    		updateHash,
    		skillChanged,
    		itemModChange,
    		run
    	});

    	$$self.$inject_state = $$props => {
    		if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
    		if ("report" in $$props) $$invalidate(0, report = $$props.report);
    		if ("processNextHashChange" in $$props) processNextHashChange = $$props.processNextHashChange;
    		if ("state" in $$props) $$invalidate(1, state = $$props.state);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		report,
    		state,
    		hashchange,
    		updateHash,
    		skillChanged,
    		itemModChange,
    		run,
    		select0_change_handler,
    		change_handler,
    		input_change_handler,
    		$$binding_groups,
    		select1_change_handler,
    		change_handler_1,
    		input_change_handler_1,
    		select_change_handler,
    		change_handler_2,
    		input_input_handler,
    		textarea_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
