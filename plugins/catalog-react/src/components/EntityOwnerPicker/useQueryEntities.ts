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
import { catalogApiRef } from '../../api';
import useAsyncFn from 'react-use/esm/useAsyncFn';
import { Entity } from '@backstage/catalog-model';
import { CombinedRequest, CombinedResponse } from './useFetchEntities';

export type QueryEntitiesResponse = {
  items: Entity[];
  cursor?: string;
};

export function useQueryEntities() {
  const catalogApi = useApi(catalogApiRef);

  return useAsyncFn<
    (
      request: CombinedRequest,
      options?: { limit?: number },
    ) => Promise<CombinedResponse>
  >(
    async (request, options) => {
      const limit = options?.limit ?? 20;

      if ('cursor' in request) {
        const response = await catalogApi.queryEntities({
          cursor: request.cursor,
          limit,
        });
        const ret: QueryEntitiesResponse = {
          cursor: response.pageInfo.nextCursor,
          items: [...request.items, ...response.items],
        };
        return ret;
      }
      const text = 'text' in request ? request.text : '';

      const response = await catalogApi.queryEntities({
        fullTextFilter: {
          term: text,
          fields: [
            'metadata.name',
            'kind',
            'spec.profile.displayname',
            'metadata.title',
          ],
        },
        filter: { kind: ['User', 'Group'] },
        orderFields: [{ field: 'metadata.name', order: 'asc' }],
        limit,
      });

      const ret: QueryEntitiesResponse = {
        cursor: response.pageInfo.nextCursor,
        items: response.items,
      };
      return ret;
    },
    [],
    { loading: true, value: { items: [] } },
  );
}
