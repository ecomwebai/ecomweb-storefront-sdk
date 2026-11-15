import { describe, expectTypeOf, it } from "vitest";
import type {
  BlogPost,
  Collection,
  ContentPage,
  OrdersApi,
  ProductDetail,
  StoreConfigurationInfo,
} from "../index";
import type { ResolvedMetaobjectRef, StorefrontMetafields } from "./metafields";

type Maybe = StorefrontMetafields | undefined;

describe("owner detail types", () => {
  it("carry optional storefront metafields", () => {
    expectTypeOf<ProductDetail["metafields"]>().toEqualTypeOf<Maybe>();
    expectTypeOf<ProductDetail["variants"][number]["metafields"]>().toEqualTypeOf<Maybe>();
    expectTypeOf<Collection["metafields"]>().toEqualTypeOf<Maybe>();
    expectTypeOf<BlogPost["metafields"]>().toEqualTypeOf<Maybe>();
    expectTypeOf<ContentPage["metafields"]>().toEqualTypeOf<Maybe>();
    expectTypeOf<StoreConfigurationInfo["metafields"]>().toEqualTypeOf<Maybe>();
    type CustomerOrder = Awaited<ReturnType<OrdersApi["getCustomerOrder"]>>;
    expectTypeOf<CustomerOrder["metafields"]>().toEqualTypeOf<Maybe>();
  });

  it("nest metaobject fields as storefront metafields", () => {
    expectTypeOf<ResolvedMetaobjectRef["fields"]>().toEqualTypeOf<StorefrontMetafields>();
  });
});
