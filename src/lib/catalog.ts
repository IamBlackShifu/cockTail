export type Cocktail = { id: number; name: string; note: string; description: string; price: number; category: string; image: string; strength: string; tone: string; available?: boolean; featured?: boolean; displayOrder?: number };
export type FlavourIndicator = "Sweet" | "Sour" | "Smoky" | "Creamy" | "Strong";
export type ManagedProduct = Cocktail & { priceCents: number; active: boolean; available: boolean; manualAvailable: boolean; inventoryAvailable: boolean; unavailableIngredients: string[]; featured: boolean; displayOrder: number; version: number; createdAt: string; updatedAt: string };
export type CustomOption = { label: string; price: number };
export type BuilderOptionGroup = "spirit" | "mixer" | "finish";
export type ManagedIngredient = CustomOption & { id: number; group: BuilderOptionGroup; priceCents: number; active: boolean; available: boolean; displayOrder: number; version: number };
export type BuilderOptions = Record<BuilderOptionGroup, CustomOption[]>;
export const cocktails: Cocktail[] = [
  { id: 1, name: "Sex on the Beach", note: "Vodka · peach schnapps · orange · cranberry", description: "Juicy, sweet and fruit-forward with a gentle citrus tang. Easy-drinking and bright.", price: 13, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/sex-on-the-beach.jpg", strength: "Medium", tone: "sunset" },
  { id: 2, name: "Piña Colada", note: "White rum · pineapple · coconut cream · lime", description: "Creamy and tropical, with ripe pineapple sweetness and a fresh lime finish.", price: 14, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/pina-colada.jpg", strength: "Medium", tone: "lime" },
  { id: 3, name: "Margarita", note: "Blanco tequila · orange liqueur · lime · agave · salt", description: "Crisp, zesty and refreshingly sour, balanced by orange and a touch of agave.", price: 14, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/margarita.jpg", strength: "Medium", tone: "mint" },
  { id: 4, name: "Long Island Iced Tea", note: "Vodka · gin · tequila · white rum · orange liqueur · lemon · cola", description: "Bold and boozy, yet deceptively smooth, with bright lemon and a lightly spiced cola finish.", price: 17, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/long-island-iced-tea.jpg", strength: "Strong", tone: "ruby" },
  { id: 5, name: "Whiskey Sour", note: "Bourbon · lemon · simple syrup · aromatic bitters", description: "Silky, warming and citrus-sharp, with mellow oak sweetness and a bittersweet finish.", price: 15, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/whiskey-sour.jpg", strength: "Medium", tone: "sunset" },
  { id: 6, name: "Midnight Mischief", note: "Dark rum · blackcurrant · coffee liqueur · lime · ginger beer", description: "Dark berry and bittersweet coffee meet warming ginger—a rich, lively drink with a mysterious edge.", price: 16, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/midnight-mischief.jpg", strength: "Strong", tone: "violet" },
  { id: 7, name: "The Forbidden Kiss", note: "Gin · raspberry · pomegranate · lemon · rose", description: "Floral and seductive, balancing lush berry sweetness with a tart, perfumed finish.", price: 15, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/the-forbidden-kiss.jpg", strength: "Medium", tone: "pink" },
  { id: 8, name: "Velvet Voodoo", note: "Aged rum · cherry · cacao · vanilla · aromatic bitters", description: "Velvety, rich and lightly spiced, with dark cherry, soft chocolate and a warming finish.", price: 16, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/velvet-voodoo.jpg", strength: "Strong", tone: "ruby" },
  { id: 9, name: "Pink Paloma", note: "Blanco tequila · pink grapefruit · lime · agave · soda · hibiscus salt", description: "Bright, sparkling and bittersweet, with tart grapefruit and a delicately salty floral rim.", price: 14, category: "Signature", image: "https://tipsygo.pro/cocktails/signatures/pink-paloma.jpg", strength: "Medium", tone: "pink" },
];

const signatureFlavours: Record<string, FlavourIndicator[]> = {
  "Sex on the Beach": ["Sweet"],
  "Piña Colada": ["Sweet", "Creamy"],
  Margarita: ["Sour"],
  "Long Island Iced Tea": ["Strong"],
  "Whiskey Sour": ["Sour"],
  "Midnight Mischief": ["Sweet", "Strong"],
  "The Forbidden Kiss": ["Sweet", "Sour"],
  "Velvet Voodoo": ["Sweet", "Strong"],
  "Pink Paloma": ["Sour"],
};

export function flavourIndicators(drink: Pick<Cocktail, "name" | "description" | "strength">): FlavourIndicator[] {
  const signature = signatureFlavours[drink.name];
  if (signature) return signature;
  const taste = drink.description.toLowerCase();
  const indicators: FlavourIndicator[] = [];
  if (/sweet|honey|caramel|vanilla|berry|fruity/.test(taste)) indicators.push("Sweet");
  if (/sour|tart|tang|zesty|citrus-sharp|grapefruit/.test(taste)) indicators.push("Sour");
  if (/smok|char|peat/.test(taste)) indicators.push("Smoky");
  if (/cream|silky|velvet/.test(taste)) indicators.push("Creamy");
  if (drink.strength.toLowerCase() === "strong") indicators.push("Strong");
  return indicators.slice(0, 3);
}

export function recommendCocktails(current: Cocktail, menu: Cocktail[], limit = 3): Cocktail[] {
  const currentFlavours = new Set(flavourIndicators(current));
  return menu
    .filter(drink => drink.id !== current.id && drink.available !== false)
    .map(drink => ({ drink, score: flavourIndicators(drink).reduce((score, flavour) => score + (currentFlavours.has(flavour) ? 4 : 0), 0) + (drink.category === current.category ? 1 : 0) }))
    .sort((left, right) => right.score - left.score || Number(right.drink.featured) - Number(left.drink.featured) || left.drink.displayOrder! - right.drink.displayOrder!)
    .slice(0, limit)
    .map(item => item.drink);
}
export const productTones = ["sunset", "ruby", "mint", "pink", "violet", "lime"] as const;
export const categories = ["All sips", "Signature", "Classic", "Fruity", "Sour", "Strong", "Low Alcohol", "Mocktails"];
export const options: BuilderOptions = { spirit: [{ label: "Vodka", price: 0 }, { label: "Gin", price: 1 }, { label: "Tequila", price: 1 }, { label: "Rum", price: 0 }], mixer: [{ label: "Passionfruit", price: 1 }, { label: "Tonic water", price: 0 }, { label: "Ginger beer", price: 1 }, { label: "Soda", price: 0 }], finish: [{ label: "Lime & mint", price: 0 }, { label: "Chilli salt", price: 1 }, { label: "Berry crown", price: 2 }] };
export const customizationGroups: { key: keyof Customization; label: string; options: CustomOption[] }[] = [
  { key: "size", label: "Choose your size", options: [{ label: "Classic", price: 0 }, { label: "Large cup", price: 3 }] },
  { key: "sweetness", label: "Sweetness", options: [{ label: "No sugar", price: 0 }, { label: "Low", price: 0 }, { label: "Normal", price: 0 }, { label: "Extra sweet", price: 0 }] },
  { key: "strength", label: "Alcohol strength", options: [{ label: "Light", price: 0 }, { label: "Standard", price: 0 }, { label: "Extra shot", price: 3 }] },
  { key: "ice", label: "Ice", options: [{ label: "No ice", price: 0 }, { label: "Normal ice", price: 0 }, { label: "Extra ice", price: 0 }, { label: "Crushed ice", price: 1 }] },
  { key: "garnish", label: "Garnish", options: [{ label: "No garnish", price: 0 }, { label: "Lime & mint", price: 0 }, { label: "Berries", price: 2 }, { label: "Cocktail cherry", price: 1 }] },
  { key: "extra", label: "Add something extra", options: [{ label: "Nothing extra", price: 0 }, { label: "Energy drink", price: 2 }, { label: "Premium spirit", price: 4 }, { label: "Snack pairing", price: 5 }] },
];
export type Customization = { size: CustomOption; sweetness: CustomOption; strength: CustomOption; ice: CustomOption; garnish: CustomOption; extra: CustomOption };
export const defaultCustomization: Customization = { size: customizationGroups[0].options[0], sweetness: customizationGroups[1].options[2], strength: customizationGroups[2].options[1], ice: customizationGroups[3].options[1], garnish: customizationGroups[4].options[1], extra: customizationGroups[5].options[0] };

