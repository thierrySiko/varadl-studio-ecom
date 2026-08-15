import Logic from "logic-solver";
import type {
  Architecture,
  ArchitecturalElement,
  Component,
  Configuration,
  VariationPoint,
} from "../model/varadl-types";

export interface SolverResult {
  valid: boolean;
  completedSelectedVariants: string[];
  trueVariables: string[];
  errors: string[];
}

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

function selectedVariantNames(configuration: Configuration): string[] {
  return configuration.selectedVariants.flatMap((selection) => selection.variants);
}

function allVariantNames(variationPoints: VariationPoint[]): string[] {
  return variationPoints.flatMap((vp) => vp.variants.map((variant) => variant.name));
}

function allComponentNames(architecture: Architecture): string[] {
  const names = new Set<string>();

  for (const element of architecture.elements) {
    if (isComponent(element)) {
      names.add(element.name);
    }
  }

  for (const vp of architecture.variationPoints) {
    for (const variant of vp.variants) {
      for (const element of variant.elements) {
        if (isComponent(element)) {
          names.add(element.name);
        }
      }
    }
  }

  return Array.from(names);
}

function variantNamesByVp(variationPoints: VariationPoint[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const vp of variationPoints) {
    for (const variant of vp.variants) {
      map.set(variant.name, vp.name);
    }
  }

  return map;
}

function selectedVariantsByVp(configuration: Configuration): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const selection of configuration.selectedVariants) {
    map.set(selection.variationPoint, selection.variants);
  }

  return map;
}

function requireAtMostOne(solver: any, variables: string[]): void {
  if (variables.length > 1) {
    solver.require(Logic.atMostOne(variables));
  }
}

function requireAtLeastOne(solver: any, variables: string[]): void {
  if (variables.length > 0) {
    solver.require(Logic.or(variables));
  }
}

function requireExactlyOne(solver: any, variables: string[]): void {
  if (variables.length > 0) {
    solver.require(Logic.exactlyOne(variables));
  }
}

function explainUnsat(
  architecture: Architecture,
  configuration: Configuration
): string[] {
  const selected = new Set(selectedVariantNames(configuration));
  const selectedByVp = selectedVariantsByVp(configuration);
  const vpByVariant = variantNamesByVp(architecture.variationPoints);
  const explanations: string[] = [];

  for (const vp of architecture.variationPoints) {
    const selectedForVp = selectedByVp.get(vp.name) ?? [];

    if (vp.type === "alternative" && selectedForVp.length !== 1) {
      explanations.push(
        `Le point de variation ${vp.name} est de type alternative : exactement une variante doit être sélectionnée.`
      );
    }

    if (vp.type === "or" && selectedForVp.length === 0) {
      explanations.push(
        `Le point de variation ${vp.name} est de type or : au moins une variante doit être sélectionnée.`
      );
    }

    if (vp.type === "optional" && selectedForVp.length > 1) {
      explanations.push(
        `Le point de variation ${vp.name} est optionnel : au maximum une variante peut être sélectionnée.`
      );
    }
  }

  for (const constraint of architecture.constraints) {
    const sourceSelected = selected.has(constraint.source);
    const targetSelected = selected.has(constraint.target);

    if (constraint.type === "requires" && sourceSelected && !targetSelected) {
      const targetVp = vpByVariant.get(constraint.target);
      const selectedForTargetVp = targetVp ? selectedByVp.get(targetVp) ?? [] : [];

      if (targetVp && selectedForTargetVp.length > 0) {
        explanations.push(
          `${constraint.source} requires ${constraint.target}, mais ${selectedForTargetVp.join(
            ", "
          )} est sélectionné pour ${targetVp}.`
        );
      } else {
        explanations.push(
          `${constraint.source} requires ${constraint.target}, mais ${constraint.target} n'est pas sélectionné.`
        );
      }
    }

    if (constraint.type === "excludes" && sourceSelected && targetSelected) {
      explanations.push(
        `${constraint.source} excludes ${constraint.target}, mais les deux éléments sont sélectionnés.`
      );
    }
  }

  return explanations.length > 0
    ? explanations
    : [
        "Configuration invalide : le modèle de contraintes traduit vers le solveur SAT est insatisfaisable.",
      ];
}

/**
 * Solveur générique de contraintes pour VarADL basé sur logic-solver.
 *
 * Le moteur reste indépendant du domaine métier. Il traduit les éléments
 * déclarés dans l'architecture VarADL en formules propositionnelles :
 * - alternative    => exactement une variante
 * - optional       => zéro ou une variante
 * - or             => au moins une variante
 * - requires(A, B) => A implique B
 * - excludes(A, B) => non(A et B)
 *
 * logic-solver s'appuie sur MiniSat pour résoudre ces formules SAT.
 */
export function solveArchitectureConfiguration(
  architecture: Architecture,
  configuration: Configuration
): SolverResult {
  const solver = new Logic.Solver();
  const variantNames = allVariantNames(architecture.variationPoints);
  const componentNames = allComponentNames(architecture);

  for (const selected of selectedVariantNames(configuration)) {
    solver.require(selected);
  }

  // Pour chaque point de variation explicitement mentionné dans la
  // configuration, les variantes NON sélectionnées de ce même point sont
  // forcées à faux. Sans cela, une contrainte "requires" ciblant une
  // variante d'un point de type `or`/`optional` peut être satisfaite en
  // activant silencieusement une variante que l'utilisateur n'a jamais
  // choisie, alors que sa sélection était explicite et partielle sur ce
  // point précis. Les points de variation absents de la configuration
  // restent libres : le solveur peut toujours les compléter automatiquement
  // (comportement voulu, cf. `completedSelectedVariants`).
  const selectedByVpForClosure = selectedVariantsByVp(configuration);
  for (const vp of architecture.variationPoints) {
    const explicitlySelected = selectedByVpForClosure.get(vp.name);
    if (explicitlySelected === undefined) continue;

    for (const variant of vp.variants) {
      if (!explicitlySelected.includes(variant.name)) {
        solver.require(Logic.not(variant.name));
      }
    }
  }

  for (const flag of configuration.flags) {
    solver.require(flag);
  }

  // Les composants du noyau architectural non optionnels sont toujours présents.
  for (const element of architecture.elements) {
    if (isComponent(element) && !element.optional) {
      solver.require(element.name);
    }
  }

  for (const vp of architecture.variationPoints) {
    const variants = vp.variants.map((variant) => variant.name);

    if (vp.type === "alternative") {
      requireExactlyOne(solver, variants);
    }

    if (vp.type === "optional") {
      requireAtMostOne(solver, variants);
    }

    if (vp.type === "or") {
      requireAtLeastOne(solver, variants);
    }

    for (const variant of vp.variants) {
      for (const element of variant.elements) {
        if (isComponent(element)) {
          // Si une variante est activée, les composants qu'elle introduit
          // deviennent actifs dans l'architecture dérivée.
          solver.require(Logic.implies(variant.name, element.name));
        }
      }
    }
  }

  for (const constraint of architecture.constraints) {
    if (constraint.type === "requires") {
      solver.require(Logic.implies(constraint.source, constraint.target));
    }

    if (constraint.type === "excludes") {
      solver.require(Logic.not(Logic.and(constraint.source, constraint.target)));
    }
  }

  const solution = solver.solve();

  if (!solution) {
    return {
      valid: false,
      completedSelectedVariants: [],
      trueVariables: [],
      errors: explainUnsat(architecture, configuration),
    };
  }

  const trueVariables = solution
    .getTrueVars()
    .filter((name: string) =>
      variantNames.includes(name) ||
      componentNames.includes(name) ||
      configuration.flags.includes(name)
    );

  return {
    valid: true,
    completedSelectedVariants: variantNames.filter((name) =>
      trueVariables.includes(name)
    ),
    trueVariables,
    errors: [],
  };
}
