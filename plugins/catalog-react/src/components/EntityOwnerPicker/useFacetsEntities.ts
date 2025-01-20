/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useApi } from '@backstage/core-plugin-api';
import useAsyncFn from 'react-use/esm/useAsyncFn';
import { catalogApiRef } from '../../api';
import { useEffect } from 'react';
import { Entity, parseEntityRef } from '@backstage/catalog-model';
import { CombinedRequest, CombinedResponse } from './useFetchEntities';

type FacetsCursor = {
  start: number;
  text: string;
};

export type FacetsEntitiesResponse = {
  items: Entity[];
  cursor?: string;
};

type FacetsInitialRequest = {
  text: string;
};

/**
 * This hook asynchronously loads the entity owners using the facets endpoint.
 * EntityOwnerPicker uses this hook when mode="owners-only" is passed as prop.
 * All the owners are kept internally in memory and rendered in batches once requested
 * by the frontend. The values returned by this hook are compatible with `useQueryEntities`
 * hook, which is also used by EntityOwnerPicker.
 * In this mode, the EntityOwnerPicker won't show detailed information of the owners.
 */
export function useFacetsEntities({
  enabled,
  selectedKind,
}: {
  enabled: boolean;
  selectedKind?: string;
}) {
  const catalogApi = useApi(catalogApiRef);

  const [state, doFetch] = useAsyncFn<
    (
      request: CombinedRequest,
      options?: { limit?: number },
    ) => Promise<CombinedResponse>
  >(
    async (request, options) => {
      if (!enabled || !selectedKind) {
        return { items: [] };
      }

      const facet = 'relations.ownedBy';
      let filterObj: { key: string; values: string[] }[] | undefined;
      if (selectedKind) {
        const lower = selectedKind.toLocaleLowerCase('en-US');
        if (lower === 'group' || lower === 'user') {
          filterObj = [{ key: 'kind', values: [selectedKind] }];
        } else {
          filterObj = undefined;
        }
      }

      try {
        const response = await catalogApi.getEntityFacets({
          facets: [facet],
          filter: filterObj,
        });

        const rawList = response.facets[facet]?.map(e => e.value) ?? [];
        const facets = rawList.map(ref => {
          const { kind, name, namespace } = parseEntityRef(ref);
          return {
            apiVersion: 'backstage.io/v1beta1',
            kind,
            metadata: { name, namespace },
          } as Entity;
        });

        const limit = options?.limit ?? 20;
        const { text, start } = decodeCursor(request);
        const filteredRefs = facets.filter(e => filterEntity(text, e));

        const sortedItems = filteredRefs.sort((a, b) => {
          if (a.kind < b.kind) return -1;
          if (a.kind > b.kind) return 1;
          if (a.metadata.namespace && b.metadata.namespace) {
            if (a.metadata.namespace < b.metadata.namespace) return -1;
            if (a.metadata.namespace > b.metadata.namespace) return 1;
          }
          if (a.metadata.name < b.metadata.name) return -1;
          if (a.metadata.name > b.metadata.name) return 1;
          return 0;
        });

        const end = start + limit;
        const ret: FacetsEntitiesResponse = {
          items: sortedItems.slice(0, end),
          ...encodeCursor({
            entities: sortedItems,
            limit: end,
            payload: { text, start: end },
          }),
        };
        return ret;
      } catch (err) {
        return { items: [] } as FacetsEntitiesResponse;
      }
    },
    [enabled, selectedKind],
    {
      loading: true,
      value: { items: [] },
    },
  );

  useEffect(() => {
    if (enabled && selectedKind) {
      doFetch({ text: '' });
    }
  }, [enabled, selectedKind, doFetch]);

  return [state, doFetch] as const;
}

function decodeCursor(request: CombinedRequest): FacetsCursor {
  if ('cursor' in request) {
    return JSON.parse(atob(request.cursor!));
  }
  return {
    text: (request as FacetsInitialRequest).text || '',
    start: 0,
  };
}

function encodeCursor({
  entities,
  limit,
  payload,
}: {
  entities: Entity[];
  limit: number;
  payload: { text: string; start: number };
}) {
  if (entities.length > limit) {
    return { cursor: btoa(JSON.stringify(payload)) };
  }
  return {};
}

function filterEntity(text: string, entity: Entity) {
  const normalizedText = text.trim();
  return (
    entity.kind.includes(normalizedText) ||
    entity.metadata.namespace?.includes(normalizedText) ||
    entity.metadata.name.includes(normalizedText)
  );
}
