// ---------------------------------------------------------------------------
// names.js — a name for every seed.
//
// An avatar with an id like `agent:k5oln3wd` is a row in a database. The same
// avatar called Waffle is somebody. The name costs nothing — it is the seed
// read a different way — but it is the difference between demonstrating a
// component and introducing a character.
//
// Deterministic, like everything else here: the same seed is always the same
// name, on every device, with nothing stored.
// ---------------------------------------------------------------------------
import { hash } from './humation.js'

/**
 * Agent names.
 *
 * Short, warm and a little silly. An AI receptionist called ARIA-9 sounds like
 * it will read you terms and conditions; one called Waffle sounds like it will
 * help. The list stays concrete — objects, weather, snacks — because abstract
 * names ("Nexus", "Synergy") are the ones that all sound the same.
 */
const AGENT_NAMES = [
  'Waffle', 'Pixel', 'Nimbus', 'Mochi', 'Cosmo', 'Pepper', 'Biscuit', 'Ziggy',
  'Tango', 'Domino', 'Juniper', 'Quill', 'Rusty', 'Sable', 'Tumble', 'Wobble',
  'Bolt', 'Clover', 'Doodle', 'Ember', 'Fig', 'Gizmo', 'Halo', 'Indigo',
  'Jelly', 'Kettle', 'Lumen', 'Maple', 'Noodle', 'Olive', 'Puffin', 'Quartz',
  'Ripple', 'Sprout', 'Thimble', 'Umbra', 'Velvet', 'Willow', 'Yolk', 'Zest',
  'Apricot', 'Bramble', 'Cinder', 'Dune', 'Echo', 'Flint', 'Ginger', 'Hazel',
]

/** A tail for some of them, so a crowd of agents does not read as a list. */
const AGENT_TAGS = ['', '', '', '', ' II', ' Jr', '-7', '-01', '-X', ' Prime']

// People get real first names, weighted towards the ones this project was
// built around — a Slovak reception desk — with enough international ones that
// a crowd does not read as one town.
const FEMALE = [
  'Ivana', 'Lucia', 'Zuzana', 'Katarína', 'Martina', 'Petra', 'Jana', 'Veronika',
  'Simona', 'Nina', 'Alena', 'Dana', 'Elena', 'Hana', 'Klára', 'Lenka',
  'Maja', 'Nora', 'Sofia', 'Tereza', 'Amara', 'Beatriz', 'Chiara', 'Delphine',
  'Esme', 'Freya', 'Greta', 'Ingrid', 'Junko', 'Leila', 'Mira', 'Priya',
]
const MALE = [
  'Marek', 'Peter', 'Tomáš', 'Juraj', 'Martin', 'Michal', 'Andrej', 'Boris',
  'Dušan', 'Filip', 'Igor', 'Jakub', 'Karol', 'Lukáš', 'Matúš', 'Norbert',
  'Ondrej', 'Radovan', 'Samuel', 'Viktor', 'Anton', 'Diego', 'Emil', 'Frans',
  'Goran', 'Hugo', 'Ilya', 'Jonas', 'Kwame', 'Malik', 'Rafael', 'Yusuf',
]

/** Surname initial, so two Lucias in one crowd are still two people. */
const INITIALS = 'ABCDEFGHIJKLMNOPRSTUVZ'

/**
 * The name for a seed.
 *
 * @param {string} seed  the id the avatar is built from
 * @param {object} [who]
 * @param {'agent'|'customer'} [who.kind]
 * @param {'male'|'female'} [who.gender]  people only; omitted picks either
 * @returns {string}
 */
export function nameFor(seed, { kind = 'agent', gender } = {}) {
  // Unsigned, always: a signed shift can come out negative, and a negative
  // index into a list is `undefined` — which is how a name ends up reading
  // "Zestundefined".
  const h = hash(String(seed || 'avatar')) >>> 0
  const pick = (list, shift) => list[((h >>> shift) % list.length + list.length) % list.length]
  if (kind === 'agent') {
    return pick(AGENT_NAMES, 0) + pick(AGENT_TAGS, 5)
  }
  // With no gender given the seed decides, so a person's name and their drawing
  // are decided by the same throw rather than drifting apart.
  const list = gender === 'male' ? MALE : gender === 'female' ? FEMALE : (h >>> 3) % 2 ? MALE : FEMALE
  return `${pick(list, 0)} ${pick(INITIALS.split(''), 7)}.`
}

/** Every name this can produce, for anyone who wants to count. */
export const NAME_SPACE = {
  agents: AGENT_NAMES.length * AGENT_TAGS.length,
  people: (FEMALE.length + MALE.length) * INITIALS.length,
}
